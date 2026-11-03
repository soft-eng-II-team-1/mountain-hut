import { jest } from '@jest/globals';

// Transaction client mock: the same object is used as "tx" inside $transaction
const tx = {
    slot: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    table: { count: jest.fn() },
    slot_table: { createMany: jest.fn(), deleteMany: jest.fn() },
    reservation: { findFirst: jest.fn() },
    reservation_table: { findFirst: jest.fn() },
};

const prismaMock = {
    slot: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
};

// Prisma mock
jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: SlotDAO } = await import('../../dao/SlotDAO.js');
const slotDao = new SlotDAO();

const SLOT_ID = 'slot-1';
const START = new Date('2030-07-01T12:00:00Z');
const END = new Date('2030-07-01T13:00:00Z');

// Slot as returned by prisma with include: { slot_table: { include: { table: true } } }
const dbSlot = (...tables) => ({
    slot_id: SLOT_ID,
    date_time_start: START,
    date_time_end: END,
    slot_table: tables.map(([number, seats]) => ({
        table: { table_id: `id-${number}`, number, seats },
    })),
});

// Sets up a valid scenario: the slot exists, no overlap, all tables exist, no reservations
const setupValidSlot = (tableCount) => {
    tx.slot.findUnique.mockResolvedValue(dbSlot(['T1', 4], ['T2', 2]));
    tx.slot.findFirst.mockResolvedValue(null);
    tx.table.count.mockResolvedValue(tableCount);
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.reservation_table.findFirst.mockResolvedValue(null);
};

beforeEach(() => {
    jest.resetAllMocks();
    // By default the transaction just runs the callback with the tx mock
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
});

describe('SlotDAO.getSlots', () => {
    it('returns each slot with its tables sorted by number and the total seats', async () => {
        prismaMock.slot.findMany.mockResolvedValue([dbSlot(['T10', 2], ['T2', 4], ['T1', 6])]);

        const slots = await slotDao.getSlots();

        expect(prismaMock.slot.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {},
            orderBy: { date_time_start: 'asc' },
        }));
        expect(slots).toEqual([{
            slot_id: SLOT_ID,
            date_time_start: START,
            date_time_end: END,
            tables: [
                { table_id: 'id-T1', number: 'T1', seats: 6 },
                { table_id: 'id-T2', number: 'T2', seats: 4 },
                { table_id: 'id-T10', number: 'T10', seats: 2 },
            ],
            total_seats: 12,
        }]);
    });

    it('returns only the slots overlapping the given period', async () => {
        prismaMock.slot.findMany.mockResolvedValue([]);

        await slotDao.getSlots(START, END);

        expect(prismaMock.slot.findMany.mock.calls[0][0].where).toEqual({
            date_time_end: { gt: START },
            date_time_start: { lt: END },
        });
    });
});

describe('SlotDAO.getSlotById', () => {
    it('returns the slot with its tables', async () => {
        prismaMock.slot.findUnique.mockResolvedValue(dbSlot(['T1', 4]));

        const slot = await slotDao.getSlotById(SLOT_ID);

        expect(slot.tables).toEqual([{ table_id: 'id-T1', number: 'T1', seats: 4 }]);
        expect(slot.total_seats).toBe(4);
    });

    it('throws if the slot does not exist', async () => {
        prismaMock.slot.findUnique.mockResolvedValue(null);

        await expect(slotDao.getSlotById(SLOT_ID)).rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
    });
});

describe('SlotDAO.createSlot', () => {
    it('creates the slot and links its tables', async () => {
        setupValidSlot(2);

        const result = await slotDao.createSlot({ start: START, end: END, tableIds: ['id-T1', 'id-T2'] });

        const { data } = tx.slot.create.mock.calls[0][0];
        expect(data).toMatchObject({ date_time_start: START, date_time_end: END });

        const rows = tx.slot_table.createMany.mock.calls[0][0].data;
        expect(rows).toEqual([
            expect.objectContaining({ slot_id: data.slot_id, table_id: 'id-T1' }),
            expect.objectContaining({ slot_id: data.slot_id, table_id: 'id-T2' }),
        ]);

        expect(result.total_seats).toBe(6);
    });

    it('ignores duplicated table ids', async () => {
        setupValidSlot(1);

        await slotDao.createSlot({ start: START, end: END, tableIds: ['id-T1', 'id-T1'] });

        const rows = tx.slot_table.createMany.mock.calls[0][0].data;
        expect(rows).toHaveLength(1);
    });

    it('throws if the slot overlaps an existing one', async () => {
        setupValidSlot(1);
        tx.slot.findFirst.mockResolvedValue({ slot_id: 'other-slot' });

        await expect(slotDao.createSlot({ start: START, end: END, tableIds: ['id-T1'] }))
            .rejects.toMatchObject({ code: 'SLOT_OVERLAP' });
        expect(tx.slot.findFirst).toHaveBeenCalledWith({
            where: { date_time_start: { lt: END }, date_time_end: { gt: START } },
        });
        expect(tx.slot.create).not.toHaveBeenCalled();
    });

    it('throws if a table does not exist', async () => {
        // 2 tables requested, only 1 found
        setupValidSlot(1);

        await expect(slotDao.createSlot({ start: START, end: END, tableIds: ['id-T1', 'id-X'] }))
            .rejects.toMatchObject({ code: 'TABLE_NOT_FOUND' });
        expect(tx.slot.create).not.toHaveBeenCalled();
    });
});

describe('SlotDAO.updateSlot', () => {
    it('updates the times and replaces the list of tables', async () => {
        setupValidSlot(1);

        await slotDao.updateSlot(SLOT_ID, { start: START, end: END, tableIds: ['id-T3'] });

        expect(tx.slot.update).toHaveBeenCalledWith({
            where: { slot_id: SLOT_ID },
            data: { date_time_start: START, date_time_end: END },
        });
        expect(tx.slot_table.deleteMany).toHaveBeenCalledWith({ where: { slot_id: SLOT_ID } });
        const rows = tx.slot_table.createMany.mock.calls[0][0].data;
        expect(rows).toEqual([expect.objectContaining({ slot_id: SLOT_ID, table_id: 'id-T3' })]);
    });

    it('does not consider the slot itself when checking the overlap', async () => {
        setupValidSlot(0);

        await slotDao.updateSlot(SLOT_ID, { start: START, end: END, tableIds: [] });

        expect(tx.slot.findFirst.mock.calls[0][0].where.slot_id).toEqual({ not: SLOT_ID });
    });

    it('throws if the slot does not exist', async () => {
        setupValidSlot(1);
        tx.slot.findUnique.mockResolvedValue(null);

        await expect(slotDao.updateSlot(SLOT_ID, { start: START, end: END, tableIds: ['id-T1'] }))
            .rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
        expect(tx.slot.update).not.toHaveBeenCalled();
    });

    it('throws if a removed table has reservations in the slot', async () => {
        setupValidSlot(1);
        tx.reservation_table.findFirst.mockResolvedValue({ table_id: 'id-T2', seats_reserved: 2 });

        await expect(slotDao.updateSlot(SLOT_ID, { start: START, end: END, tableIds: ['id-T1'] }))
            .rejects.toMatchObject({ code: 'HAS_RESERVATIONS' });
        expect(tx.slot.update).not.toHaveBeenCalled();
        expect(tx.slot_table.deleteMany).not.toHaveBeenCalled();
    });
});

describe('SlotDAO.deleteSlot', () => {
    it('deletes the slot and its tables', async () => {
        setupValidSlot(0);

        await slotDao.deleteSlot(SLOT_ID);

        expect(tx.slot_table.deleteMany).toHaveBeenCalledWith({ where: { slot_id: SLOT_ID } });
        expect(tx.slot.delete).toHaveBeenCalledWith({ where: { slot_id: SLOT_ID } });
    });

    it('throws if the slot does not exist', async () => {
        setupValidSlot(0);
        tx.slot.findUnique.mockResolvedValue(null);

        await expect(slotDao.deleteSlot(SLOT_ID)).rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
        expect(tx.slot.delete).not.toHaveBeenCalled();
    });

    it('throws if the slot has reservations', async () => {
        setupValidSlot(0);
        tx.reservation.findFirst.mockResolvedValue({ reservation_id: 'r-1', slot_id: SLOT_ID });

        await expect(slotDao.deleteSlot(SLOT_ID)).rejects.toMatchObject({ code: 'HAS_RESERVATIONS' });
        expect(tx.slot.delete).not.toHaveBeenCalled();
    });
});
