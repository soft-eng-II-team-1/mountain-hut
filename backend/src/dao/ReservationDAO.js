import { prisma } from '../../prisma.client.ts';
import crypto from 'crypto';
import { assignTables } from '../services/tableAssignment.js';
import { isSerializationConflict, runSerializable } from './transaction.js';

// How many times a booking is retried when it collides with a concurrent one on the same slot
const MAX_BOOKING_ATTEMPTS = 3;

//error with a code that the routes translates into an HTTP status 
export class ReservationError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }   
}

// MH-06 : a reservation can be changed only up to 48h before its current slot starts
const MODIFICATION_CUTOFF_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

// a slot can be booked only up to 2 hours before it starts (valid also when moving a reservation)
const BOOKING_CUTOFF_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

const concurrentBooking = () => new ReservationError('CONCURRENT_UPDATE', 'The slot is being booked by other hikers, please try again');

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

    // `requirements` are the optional needs of the party (e.g. allergies), null if none
    static async saveReservation(userId, slotId, people, requirements = null) {
        // Checks and inserts run in a SERIALIZABLE transaction: two hikers booking the
        // same slot at the same time cannot both read the same free seats (overbooking),
        // and the same hiker cannot create two reservations for the slot.
        for (let attempt = 1; ; attempt++) {
            try {
                return await prisma.$transaction(
                    tx => this.createReservation(tx, userId, slotId, people, requirements),
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

    // Must be called inside a transaction (see saveReservation)
    static async createReservation(tx, userId, slotId, people, requirements = null) {
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
                requirements: requirements,
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

    //change slot, partySize and requirements of a reservation
    //booking reference doesn't change, table are reassigned when strictly necessary
    //returns { changed : false} if nothing changed
    static async updateReservation(reservationId, userId, {slotId, people, requirements}) {
        return runSerializable(async (tx) => {
            //Hiker's reservation
            const reservation = await tx.reservation.findFirst({
                where: { reservation_id: reservationId, user_id: userId },
                include: { slot: true, reservation_table: true }
            });
            if(!reservation) {
                throw new ReservationError('NOT_FOUND', 'Reservation not found');
            }

            //48h rule on the current slot
            if(reservation.slot.date_time_start.getTime() - Date.now() < MODIFICATION_CUTOFF_MS) {
                throw new ReservationError('TOO_LATE', 'Reservation can be changed only up to 48h before the slot starts');    
            }

            //if the request doesn't change anything it does nothing 
            const slotChanged = slotId !== reservation.slot_id;
            const peopleChanged = people !== reservation.people;
            const requirementsChanged = requirements !== reservation.requirements;
            if(!slotChanged && !peopleChanged && !requirementsChanged) {
                return { changed: false };
            }

            //tables assignment is modified only if the slot or the party size changes
            if(slotChanged) {
                await this.moveToSlot(tx, reservation, slotId, people);
            } else if(people < reservation.people) {
                await this.shrinkParty(tx, reservation.reservation_table, reservation.people - people);
            } else if(people > reservation.people) {
                await this.growParty(tx, reservation, people);
            }

            //reservation_id stays the same
            await tx.reservation.update({
                where: { reservation_id: reservationId },
                data: {slot_id: slotId, people, requirements}
            });

            return {changed: true};
        }, concurrentBooking);
    }

    //Change booking --> moves the reservation to another slot: tables are assigned from scratch
    static async moveToSlot(tx, reservation, slotId, people) {
        const newSlot = await tx.slot.findUnique({where: {slot_id: slotId}});
        if(!newSlot) {
            throw new ReservationError('SLOT_NOT_FOUND', 'Slot not found');
        }

        if(newSlot.date_time_start.getTime() - Date.now() < BOOKING_CUTOFF_MS) {
            throw new ReservationError('TOO_LATE', 'Reservations must be made at least 2 hours before the slot starts');
        }

        //only one booking per time slot rule
        const otherBooking = await tx.reservation.findFirst({
            where: {slot_id: slotId,
                    user_id: reservation.user_id,
                    reservation_id: {not: reservation.reservation_id}
            }
        });
        if(otherBooking) {
            throw new ReservationError('ALREADY_BOOKED', 'You already have a reservation for this time slot');
        }

        await tx.reservation_table.deleteMany({where: {reservation_id: reservation.reservation_id}});
        await this.assignAndSaveTables(tx, reservation.reservation_id, slotId, people);
    }

    //Change booking --> smaller party in the same slot
    //keep the tables and removes occupied seats starting from the table with the least seats of that party 
    //a table left with 0 seats is released
    static async shrinkParty(tx, rows, seatsToRemove) {
        const ordered = [...rows].sort((a, b) => a.seats_reserved - b.seats_reserved);
        for(const row of ordered) {
            if(seatsToRemove === 0) break;
            const removed = Math.min(row.seats_reserved, seatsToRemove);
            seatsToRemove -= removed;
            if(removed === row.seats_reserved) {
                await tx.reservation_table.delete({where: {id: row.id}});
            } else {
                await tx.reservation_table.update({
                    where: {id: row.id},
                    data: {seats_reserved: row.seats_reserved - removed}
                });
            }
        }
    }

    //Change booking --> bigger party in the same slot
    //uses free seats of the party's table first, if not enough free, whole party is reassigned
    static async growParty(tx, reservation, people) {
        const extraSeats = people - reservation.people;

        //if there aren't enough free seats for the extra people, the party cannot be seated
        const availability = await this.checkAvailability(reservation.slot_id, extraSeats, tx);
        if(!availability.available) {
            throw new ReservationError('INSUFFICIENT_SEATS', 'Insufficient seats available for this party size');
        }   

        const ownRows = new Map(reservation.reservation_table.map(rt => [rt.table_id, rt]));
        const ownFreeTables = availability.availableTables
            .filter(t => ownRows.has(t.table_id))
            .sort((a, b) => b.remainingSeats - a.remainingSeats);
        const freeOnOwnTables = ownFreeTables.reduce((sum, t) => sum + t.remainingSeats, 0);

        if(freeOnOwnTables >= extraSeats) {
            //enough free seats on the party's tables, assign them first
            let left = extraSeats;
            for(const table of ownFreeTables) {
                if(left === 0) break;
                const row = ownRows.get(table.table_id);
                const added = Math.min(left, table.remainingSeats);
                await tx.reservation_table.update({
                    where: {id: row.id},
                    data: {seats_reserved: row.seats_reserved + added}
                });
                left -= added;
            }
            return;
        }

        //not enough free seats on the party's tables, reassign the whole party
        await tx.reservation_table.deleteMany({where: {reservation_id: reservation.reservation_id}});
        await this.assignAndSaveTables(tx, reservation.reservation_id, reservation.slot_id, people);
    }

    //assign tables with the book a table logic and saves them
    //must be called inside a transaction
    static async assignAndSaveTables(tx, reservationId, slotId, people) {
        const availability = await this.checkAvailability(slotId, people, tx);
        const assignments = availability.available && assignTables(availability.availableTables, people);
        if(!assignments) {
            throw new ReservationError('INSUFFICIENT_SEATS', 'Insufficient seats available for this party size');
        }

        await tx.reservation_table.createMany({
            data: assignments.map(a => ({
                id: crypto.randomUUID(),
                reservation_id: reservationId,
                table_id: a.table_id,
                seats_reserved: a.seats_reserved
            }))
        });
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
            requirements: reservation.requirements,
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
