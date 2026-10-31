import prisma from '../prismaClient.js';
import crypto from 'crypto';

class ReservationDAO {
    static async checkAvailability(slotId, partySize) {
        // 1. Fetch all tables assigned to this specific slot
        const slotTables = await prisma.slot_table.findMany({
            where: { slot_id: slotId },
            include: { table: true }
        });

        if (!slotTables.length) {
            throw new Error("No tables are assigned to this slot yet.");
        }

        // 2. Fetch all existing reservations for this slot to see what is taken
        const existingReservations = await prisma.reservation_table.findMany({
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

        // 4. Enforce business rule: check if total capacity meets the party size
        if (totalAvailableSeats < partySize) {
            return { available: false, totalAvailableSeats, availableTables: [] };
        }

        // Note for MH-43: The story requires keeping parties together. 
        // You will use this 'availableTables' array later to calculate the optimal split.
        return {
            available: true,
            totalAvailableSeats,
            availableTables
        };
    }

    static async saveReservation(userId, slotId, people) {
        // 1. Fetch slot to check the 2-hour cutoff rule
        const slot = await prisma.slot.findUnique({
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
        const existingBooking = await prisma.reservation.findFirst({
            where: { slot_id: slotId, user_id: userId }
        });
        if (existingBooking) {
            throw new Error("You already have a reservation for this time slot");
        }

        // 3. Check total seat availability
        const availability = await this.checkAvailability(slotId, people);
        if (!availability.available) {
            throw new Error("Insufficient seats available for this party size");
        }

        // 4. Table Assignment Algorithm
        const tables = availability.availableTables; // [{ table_id, number, remainingSeats }]
        const tableAssignments = [];

        // Case A: Try to fit the whole party at a single table (smallest fit first)
        const singleTableFit = tables
            .filter(t => t.remainingSeats >= people)
            .sort((a, b) => a.remainingSeats - b.remainingSeats)[0];

        if (singleTableFit) {
            tableAssignments.push({
                table_id: singleTableFit.table_id,
                seats_reserved: people
            });
        } else {
            // Case B: Split across as few tables as possible
            // Sort largest to smallest to minimize the number of tables used
            const sortedDesc = [...tables].sort((a, b) => b.remainingSeats - a.remainingSeats);
            let remainingPeople = people;

            for (let i = 0; i < sortedDesc.length && remainingPeople > 0; i++) {
                // Before taking a huge table for the last few people, check if a smaller table fits the exact remainder
                const restOfTables = sortedDesc.slice(i);
                const smallestFitForRemainder = restOfTables
                    .filter(t => t.remainingSeats >= remainingPeople)
                    .sort((a, b) => a.remainingSeats - b.remainingSeats)[0];

                if (smallestFitForRemainder) {
                    tableAssignments.push({
                        table_id: smallestFitForRemainder.table_id,
                        seats_reserved: remainingPeople
                    });
                    remainingPeople = 0;
                } else {
                    // Fill the largest available table completely and continue
                    const currentTable = sortedDesc[i];
                    tableAssignments.push({
                        table_id: currentTable.table_id,
                        seats_reserved: currentTable.remainingSeats
                    });
                    remainingPeople -= currentTable.remainingSeats;
                }
            }
        }

        // 5. Save everything atomically in a transaction
        return await prisma.$transaction(async (tx) => {
            const newReservationId = crypto.randomUUID();

            const newReservation = await tx.reservation.create({
                data: {
                    reservation_id: newReservationId,
                    people: people,
                    slot_id: slotId,
                    user_id: userId
                }
            });

            const reservationTableRows = tableAssignments.map(assignment => ({
                id: crypto.randomUUID(),
                reservation_id: newReservationId,
                table_id: assignment.table_id,
                seats_reserved: assignment.seats_reserved
            }));

            await tx.reservation_table.createMany({
                data: reservationTableRows
            });

            return {
                ...newReservation,
                tables: tableAssignments
            };
        });
    }
}

export default ReservationDAO;