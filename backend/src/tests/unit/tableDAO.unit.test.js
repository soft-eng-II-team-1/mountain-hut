import { jest } from '@jest/globals';

// Transaction client mock: the same object is used as "tx" inside $transaction
const tx = {
    reservation_table: { findMany: jest.fn() },
    table: { update: jest.fn() },
};

const prismaMock = {
    $transaction: jest.fn(),
};

// Prisma mock
jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: TableDAO } = await import('../../dao/TableDAO.js');

const TABLE_ID = 'table-1';

// Row as returned by prisma with select: { seats_reserved, reservation: { select: { slot_id } } }
const reserved = (slotId, seats) => ({ seats_reserved: seats, reservation: { slot_id: slotId } });

beforeEach(() => {
    jest.resetAllMocks();
    // By default the transaction just runs the callback with the tx mock
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.table.update.mockImplementation(async ({ where, data }) => ({ table_id: where.table_id, ...data }));
});

describe('TableDAO.updateTable', () => {
    it('updates the number and the seats of a table without reservations', async () => {
        tx.reservation_table.findMany.mockResolvedValue([]);

        const table = await TableDAO.updateTable(TABLE_ID, { number: 'T1', seats: 2 });

        expect(table).toEqual({ table_id: TABLE_ID, number: 'T1', seats: 2 });
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    });

    it('only considers the reservations of slots that are not over', async () => {
        tx.reservation_table.findMany.mockResolvedValue([]);

        await TableDAO.updateTable(TABLE_ID, { number: 'T1', seats: 2 });

        const { where } = tx.reservation_table.findMany.mock.calls[0][0];
        expect(where.table_id).toBe(TABLE_ID);
        expect(where.reservation.slot.date_time_end.gt).toBeInstanceOf(Date);
    });

    it('accepts as many seats as the most reserved slot', async () => {
        // Slot A: 2 + 3 seats reserved, slot B: 4
        tx.reservation_table.findMany.mockResolvedValue([reserved('A', 2), reserved('A', 3), reserved('B', 4)]);

        const table = await TableDAO.updateTable(TABLE_ID, { number: 'T1', seats: 5 });

        expect(table.seats).toBe(5);
    });

    it('throws if the seats are fewer than the ones reserved in a slot', async () => {
        tx.reservation_table.findMany.mockResolvedValue([reserved('A', 2), reserved('A', 3), reserved('B', 4)]);

        await expect(TableDAO.updateTable(TABLE_ID, { number: 'T1', seats: 4 })).rejects.toMatchObject({
            code: 'SEATS_RESERVED',
            message: 'Cannot set fewer seats than the 5 already reserved on this table in a slot',
        });
        expect(tx.table.update).not.toHaveBeenCalled();
    });

    it('throws CONCURRENT_UPDATE after too many collisions with concurrent transactions', async () => {
        prismaMock.$transaction.mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }));

        await expect(TableDAO.updateTable(TABLE_ID, { number: 'T1', seats: 4 }))
            .rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });
    });

    it('lets prisma errors through, so the route can map them', async () => {
        prismaMock.$transaction.mockRejectedValue(Object.assign(new Error('not found'), { code: 'P2025' }));

        await expect(TableDAO.updateTable(TABLE_ID, { number: 'T1', seats: 4 })).rejects.toMatchObject({ code: 'P2025' });
    });
});
