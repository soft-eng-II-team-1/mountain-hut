import { prisma } from '../../prisma.client.ts';
import crypto from 'crypto';
import { assignTables } from '../services/tableAssignment.js';
import { isSerializationConflict } from './transaction.js';

// How many times a booking is retried when it collides with a concurrent one on the same slot
const MAX_BOOKING_ATTEMPTS = 3;

class ReservationDAO {
    // `db` can be a transaction client, so the check sees the same snapshot used to save
    static async checkAvailability(slotId, partySize, db = prisma) {
        const slot = await db.slot.findUnique({
            where: { slot_id: slotId },
            select: { slot_id: true, date_time_start: true, date_time_end: true }
        });
        if (!slot) {
            throw new Error("Slot not found");
        }

        // 1. Fetch all tables assigned to this specific slot
        const slotTables = await db.slot_table.findMany({
            where: { slot_id: slotId },
            include: { table: true }
        });

        if (!slotTables.length) {
            throw new Error("No tables are assigned to this slot yet.");
        }

        // 2. Fetch all existing reservations for this slot to see what is taken
        const existingReservations = await db.reservation_table.findMany({
            where: { reservation: { slot_id: slotId } }
        });

        // 3. Calculate remaining capacity per table
        let totalAvailableSeats = 0;
        const availableTables = slotTables.map(st => {
            const tableId = st.table_id;
            const totalSeats = st.table.seats;

            // Sum seats already reserved on this specific table for this slot
            const seatsTaken = existingReservations
                .filter(rt => rt.table_id === tableId)
                .reduce((sum, rt) => sum + rt.seats_reserved, 0);

            const remainingSeats = totalSeats - seatsTaken;
            totalAvailableSeats += remainingSeats;

            return {
                table_id: tableId,
                number: st.table.number,
                remainingSeats
            };
        }).filter(table => table.remainingSeats > 0);

        // 4. Enforce business rule: the party must fit in the free seats of the slot.
        //    Since a party can be split over any number of tables, this is also
        //    enough to guarantee that assignTables() finds an assignment.
        if (totalAvailableSeats < partySize) {
            return { available: false, slot, totalAvailableSeats, availableTables: [], suggestedTables: [] };
        }

        // Preview the same seating rules used for booking, without reserving any seats.
        const suggestedTables = assignTables(availableTables, partySize);

        return {
            available: true,
            slot,
            totalAvailableSeats,
            availableTables,
            suggestedTables
        };
    }

    // `requirements` are the optional needs of the party (e.g. allergies), null if none
    static async saveReservation(userId, slotId, people, requirements = null, options = {}) {
        // Checks and inserts run in a SERIALIZABLE transaction: two hikers booking the
        // same slot at the same time cannot both read the same free seats (overbooking),
        // and the same hiker cannot create two reservations for the slot.
        for (let attempt = 1; ; attempt++) {
            try {
                return await prisma.$transaction(
                    tx => this.createReservation(tx, userId, slotId, people, requirements, options),
                    { isolationLevel: 'Serializable' }
                );
            } catch (error) {
                if (!isSerializationConflict(error)) {
                    throw error;
                }
                if (attempt >= MAX_BOOKING_ATTEMPTS) {
                    throw new Error("The slot is being booked by other hikers, please try again");
                }
            }
        }
    }

    // MH-07: account lookup/creation happens separately; this method only books seats.
    static async saveEmployeeReservation({ slotId, people, userId = null, temporaryName = null, temporaryPhone = null, requirements = null }) {
        return this.saveReservation(userId, slotId, people, requirements, {
            employeeBooking: true, temporaryName, temporaryPhone
        });
    }

    // Must be called inside a transaction (see saveReservation)
    static async createReservation(tx, userId, slotId, people, requirements = null, options = {}) {
        const { employeeBooking = false, temporaryName = null, temporaryPhone = null } = options;

        // 1. Employees may book until the slot begins; web bookings retain their cutoff.
        const slot = await tx.slot.findUnique({
            where: { slot_id: slotId }
        });
        if (!slot) {
            throw new Error("Slot not found");
        }

        const now = new Date();
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        if (employeeBooking && new Date(slot.date_time_start) <= now) {
            throw new Error("Reservations must be made before the slot starts");
        }
        if (!employeeBooking && new Date(slot.date_time_start) - now < twoHoursInMs) {
            throw new Error("Reservations must be made at least 2 hours before the slot starts");
        }

        if (employeeBooking && userId !== null) {
            const hiker = await tx.user.findUnique({
                where: { user_id: userId },
                select: { role: true }
            });
            if (!hiker || hiker.role !== 'hiker') {
                throw new Error("Hiker not found");
            }
        }

        // 2. Check the "only one booking per time slot" rule for this hiker
        // Temporary contacts have no shared user ID and must not match each other.
        if (userId !== null) {
            const existingBooking = await tx.reservation.findFirst({
                where: { slot_id: slotId, user_id: userId }
            });
            if (existingBooking) {
                throw new Error("You already have a reservation for this time slot");
            }
        }

        // 3. Check total seat availability
        const availability = await this.checkAvailability(slotId, people, tx);
        if (!availability.available) {
            throw new Error("Insufficient seats available for this party size");
        }

        // 4. Table assignment: one table if possible, otherwise the fewest tables
        //    with the smallest set of free seats (see services/tableAssignment.js)
        const tableAssignments = assignTables(availability.availableTables, people);
        if (!tableAssignments) {
            throw new Error("Insufficient seats available for this party size");
        }

        // 5. Save the reservation and its tables
        const newReservationId = crypto.randomUUID();

        if (employeeBooking && new Date(slot.date_time_start) <= new Date()) {
            throw new Error("Reservations must be made before the slot starts");
        }

        const newReservation = await tx.reservation.create({
            data: {
                reservation_id: newReservationId,
                people: people,
                // The booking endpoint still accepts a single optional description.
                requirements: requirements ? [{ allergies: false, description: requirements }] : [],
                slot_id: slotId,
                user_id: userId,
                ...(employeeBooking ? { temporary_name: temporaryName, temporary_phone: temporaryPhone } : {})
            }
        });

        await tx.reservation_table.createMany({
            data: tableAssignments.map(assignment => ({
                id: crypto.randomUUID(),
                reservation_id: newReservationId,
                table_id: assignment.table_id,
                seats_reserved: assignment.seats_reserved
            }))
        });

        return {
            ...newReservation,
            // Preserve the booking endpoint's existing text/null response.
            requirements,
            tables: tableAssignments
        };
    }

    // Only requirements are updated; the party, slot and assigned tables stay the same.
    static async updateReservationRequirements(reservationId, userId, requirements) {
        const hasAllergies = requirements.some(requirement => requirement.allergies);
        const updated = await prisma.reservation.updateMany({
            where: { reservation_id: reservationId, user_id: userId },
            data: { requirements, has_allergies: hasAllergies }
        });
        if (updated.count === 0) {
            return null;
        }
        return { reservation_id: reservationId, requirements, has_allergies: hasAllergies };
    }

    // Details shown in the booking confirmation (MH-03): reservation, slot, hiker and tables.
    // Returns null if the reservation does not exist
    static async getReservationDetails(reservationId) {
        const reservation = await prisma.reservation.findUnique({
            where: { reservation_id: reservationId },
            include: {
                slot: true,
                user: { select: { user_id: true, name: true, surname: true, email: true } },
                reservation_table: { include: { table: true } }
            }
        });
        if (!reservation) {
            return null;
        }

        return {
            reservation_id: reservation.reservation_id,
            people: reservation.people,
            // The existing migration uses has_allergies for legacy entries.
            requirements: reservation.requirements.map(requirement => ({
                allergies: requirement.allergies ?? requirement.has_allergies,
                description: requirement.description
            })),
            has_allergies: reservation.has_allergies,
            slot: {
                slot_id: reservation.slot.slot_id,
                date_time_start: reservation.slot.date_time_start,
                date_time_end: reservation.slot.date_time_end
            },
            hiker: reservation.user,
            tables: reservation.reservation_table
                .map(rt => ({ table_id: rt.table_id, number: rt.table.number, seats_reserved: rt.seats_reserved }))
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
        };
    }
}

export default ReservationDAO;
