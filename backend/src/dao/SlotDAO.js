import crypto from 'node:crypto';

import { prisma } from '../../prisma.client.ts';
import { runSerializable } from './transaction.js';

// Error with a code that the routes translate into an HTTP status
export class SlotError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const includeTables = { slot_table: { include: { table: true } } };

const concurrentUpdate = () => new SlotError('CONCURRENT_UPDATE', 'The slots are being modified by someone else, please try again');

// Shape returned to the client: slot + its tables + total capacity
const toSlotResponse = (slot) => {
    const tables = slot.slot_table
        .map((st) => ({ table_id: st.table.table_id, number: st.table.number, seats: st.table.seats }))
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

    return {
        slot_id: slot.slot_id,
        date_time_start: slot.date_time_start,
        date_time_end: slot.date_time_end,
        tables,
        total_seats: tables.reduce((sum, t) => sum + t.seats, 0),
    };
};

// Throws if another slot overlaps [start, end). Adjacent slots  are allowed
const checkNoOverlap = async (tx, start, end, excludeSlotId) => {
    const where = {
        date_time_start: { lt: end },
        date_time_end: { gt: start },
    };
    if (excludeSlotId) {
        where.slot_id = { not: excludeSlotId };
    }

    const overlapping = await tx.slot.findFirst({ where });
    if (overlapping) {
        throw new SlotError('SLOT_OVERLAP', 'The slot overlaps with an existing slot');
    }
};

// Throws if some of the table ids do not exist
const checkTablesExist = async (tx, tableIds) => {
    const count = await tx.table.count({ where: { table_id: { in: tableIds } } });
    if (count !== tableIds.length) {
        throw new SlotError('TABLE_NOT_FOUND', 'One or more tables do not exist');
    }
};

// Links the given tables to the slot
const linkTables = async (tx, slotId, tableIds) => {
    if (tableIds.length === 0) return;
    await tx.slot_table.createMany({
        data: tableIds.map((tableId) => ({ id: crypto.randomUUID(), slot_id: slotId, table_id: tableId })),
    });
};

export default function SlotDAO() {

    // List of slots (optionally between two dates), ordered by start time
    this.getSlots = async (from, to) => {
        const where = {};
        if (from) where.date_time_end = { gt: from };
        if (to) where.date_time_start = { lt: to };

        const slots = await prisma.slot.findMany({
            where,
            include: includeTables,
            orderBy: { date_time_start: 'asc' },
        });
        return slots.map(toSlotResponse);
    };

    // Single slot with its tables
    this.getSlotById = async (slotId) => {
        const slot = await prisma.slot.findUnique({ where: { slot_id: slotId }, include: includeTables });
        if (!slot) {
            throw new SlotError('SLOT_NOT_FOUND', 'Slot not found');
        }
        return toSlotResponse(slot);
    };

    // Creates a slot together with its list of tables
    this.createSlot = async ({ start, end, tableIds }) => {
        const ids = [...new Set(tableIds)];

        return runSerializable(async (tx) => {
            await checkNoOverlap(tx, start, end);
            await checkTablesExist(tx, ids);

            const slotId = crypto.randomUUID();
            await tx.slot.create({
                data: { slot_id: slotId, date_time_start: start, date_time_end: end },
            });
            await linkTables(tx, slotId, ids);

            const created = await tx.slot.findUnique({ where: { slot_id: slotId }, include: includeTables });
            return toSlotResponse(created);
        }, concurrentUpdate);
    };

    // Updates start, end and the whole list of tables of a slot in one transaction.
    // A table that already has reservations in this slot cannot be removed,
    // and the times of a slot that has reservations cannot change
    this.updateSlot = async (slotId, { start, end, tableIds }) => {
        const ids = [...new Set(tableIds)];

        return runSerializable(async (tx) => {
            const slot = await tx.slot.findUnique({ where: { slot_id: slotId } });
            if (!slot) {
                throw new SlotError('SLOT_NOT_FOUND', 'Slot not found');
            }

            await checkNoOverlap(tx, start, end, slotId);
            await checkTablesExist(tx, ids);

            const reservedRemoved = await tx.reservation_table.findFirst({
                where: {
                    reservation: { slot_id: slotId },
                    table_id: { notIn: ids },
                },
            });
            if (reservedRemoved) {
                throw new SlotError('HAS_RESERVATIONS', 'Cannot remove a table that has reservations in this slot');
            }

            const timesChanged = slot.date_time_start.getTime() !== start.getTime()
                || slot.date_time_end.getTime() !== end.getTime();
            if (timesChanged) {
                const reservation = await tx.reservation.findFirst({ where: { slot_id: slotId } });
                if (reservation) {
                    throw new SlotError('HAS_RESERVATIONS', 'Cannot change the times of a slot that has reservations');
                }
            }

            await tx.slot.update({
                where: { slot_id: slotId },
                data: { date_time_start: start, date_time_end: end },
            });
            await tx.slot_table.deleteMany({ where: { slot_id: slotId } });
            await linkTables(tx, slotId, ids);

            const updated = await tx.slot.findUnique({ where: { slot_id: slotId }, include: includeTables });
            return toSlotResponse(updated);
        }, concurrentUpdate);
    };

    // Deletes a slot, only if it has no reservations
    this.deleteSlot = async (slotId) => {
        return runSerializable(async (tx) => {
            const slot = await tx.slot.findUnique({ where: { slot_id: slotId } });
            if (!slot) {
                throw new SlotError('SLOT_NOT_FOUND', 'Slot not found');
            }

            const reservation = await tx.reservation.findFirst({ where: { slot_id: slotId } });
            if (reservation) {
                throw new SlotError('HAS_RESERVATIONS', 'Cannot delete a slot that has reservations');
            }

            await tx.slot_table.deleteMany({ where: { slot_id: slotId } });
            await tx.slot.delete({ where: { slot_id: slotId } });
        }, concurrentUpdate);
    };
}