import { prisma } from '../../prisma.client.ts';
import crypto from 'crypto';
import { assignTables } from '../services/tableAssignment.js';

// How many times a booking is retried when it collides with a concurrent one on the same slot
const MAX_BOOKING_ATTEMPTS = 3;

class ReservationDAO {
    // `db` can be a transaction client, so the check sees the same snapshot used to save
    static async checkAvailability(slotId, partySize, db = prisma) {
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
            return { available: false, totalAvailableSeats, availableTables: [] };
        }

        return {
            available: true,
            totalAvailableSeats,
            availableTables
        };
    }

    static async saveReservation(userId, slotId, people) {
        // Checks and inserts run in a SERIALIZABLE transaction: two hikers booking the
        // same slot at the same time cannot both read the same free seats (overbooking),
        // and the same hiker cannot create two reservations for the slot.
        for (let attempt = 1; ; attempt++) {
            try {
                return await prisma.$transaction(
                    tx => this.createReservation(tx, userId, slotId, people),
                    { isolationLevel: 'Serializable' }
                );
            } catch (error) {
                if (error.code !== 'P2034') {
                    throw error;
                }
                if (attempt >= MAX_BOOKING_ATTEMPTS) {
                    throw new Error("The slot is being booked by other hikers, please try again");
                }
            }
        }
    }

    // Must be called inside a transaction (see saveReservation)
    static async createReservation(tx, userId, slotId, people) {
        // 1. Fetch slot to check the 2-hour cutoff rule
        const slot = await tx.slot.findUnique({
            where: { slot_id: slotId }
        });
        if (!slot) {
            throw new Error("Slot not found");
        }

        const now = new Date();
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        if (new Date(slot.date_time_start) - now < twoHoursInMs) {
            throw new Error("Reservations must be made at least 2 hours before the slot starts");
        }

        // 2. Check the "only one booking per time slot" rule for this hiker
        const existingBooking = await tx.reservation.findFirst({
            where: { slot_id: slotId, user_id: userId }
        });
        if (existingBooking) {
            throw new Error("You already have a reservation for this time slot");
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

        const newReservation = await tx.reservation.create({
            data: {
                reservation_id: newReservationId,
                people: people,
                slot_id: slotId,
                user_id: userId
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
            tables: tableAssignments
        };
    }
}

export default ReservationDAO;
