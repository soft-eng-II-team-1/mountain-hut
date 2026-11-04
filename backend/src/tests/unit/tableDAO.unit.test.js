import { jest } from '@jest/globals';

// Transaction client mock: the same object is used as "tx" inside $transaction
const tx = {
    reservation_table: { findMany: jest.fn() },
    table: { update: jest.fn() },
};

const prismaMock = {
    $transaction: jest.fn(),
    table: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn()
    },
    reservation_table: {
        findFirst: jest.fn()
    },
    slot_table: {
        findFirst: jest.fn()
    }
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

describe('TableDAO.getTables', () => {
    it('returns all tables', async () => {
        prismaMock.table.findMany.mockResolvedValue([{ table_id: TABLE_ID, number: 'T1', seats: 2 }, { table_id: 'table-2', number: 'T2', seats: 4 }]);

        const tables = await TableDAO.getTables();

        expect(tables).toEqual([{ table_id: TABLE_ID, number: 'T1', seats: 2 }, { table_id: 'table-2', number: 'T2', seats: 4 }]);
        expect(prismaMock.table.findMany).toHaveBeenCalledWith({ orderBy: { number: 'asc' } });
    });

    it('returns an empty array if no tables are found', async () => {
        prismaMock.table.findMany.mockResolvedValue([]);

        const tables = await TableDAO.getTables();

        expect(tables).toEqual([]);
        expect(prismaMock.table.findMany).toHaveBeenCalledWith({ orderBy: { number: 'asc' } });
    });

    it('lets prisma errors through', async () => {
        prismaMock.table.findMany.mockRejectedValue(new Error('DB down'));

        await expect(TableDAO.getTables()).rejects.toThrow('DB down');
    });
});

describe('TableDAO.createTable', () => {
    it('lets prisma errors through', async () => {
        prismaMock.table.create.mockRejectedValue(new Error('DB down'));

        await expect(TableDAO.createTable({ number: 'T1', seats: 2 })).rejects.toThrow('DB down');
    });

    it('returns the created table', async () => {
        prismaMock.table.create.mockResolvedValue({ table_id: TABLE_ID, number: 'T1', seats: 2 });

        const table = await TableDAO.createTable({ number: 'T1', seats: 2 });

        expect(table).toEqual({ table_id: TABLE_ID, number: 'T1', seats: 2 });
        expect(prismaMock.table.create).toHaveBeenCalledWith({
            data: {
                table_id: expect.any(String),
                number: 'T1',
                seats: 2
            }
        });
    });
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

describe('TableDAO.deleteTable', () => {
    it('lets prisma errors through', async () => {
        prismaMock.reservation_table.findFirst.mockResolvedValue(null);
        prismaMock.slot_table.findFirst.mockResolvedValue(null);
        prismaMock.table.delete.mockRejectedValue(new Error('DB down'));

        await expect(TableDAO.deleteTable(TABLE_ID)).rejects.toThrow('DB down');
    });

    it('deletes the table', async () => {
        prismaMock.reservation_table.findFirst.mockResolvedValue(null);
        prismaMock.slot_table.findFirst.mockResolvedValue(null);
        prismaMock.table.delete.mockResolvedValue({ table_id: TABLE_ID });

        const table = await TableDAO.deleteTable(TABLE_ID);

        expect(table).toEqual({ table_id: TABLE_ID });

        expect(prismaMock.table.delete).toHaveBeenCalledWith({
            where: { table_id: TABLE_ID }
        });
    });

    it('throws if the table has active reservations', async () => {
        prismaMock.reservation_table.findFirst.mockResolvedValue({ table_id: TABLE_ID });
        prismaMock.slot_table.findFirst.mockResolvedValue(null);
        prismaMock.table.delete.mockResolvedValue({ table_id: TABLE_ID });

        await expect(TableDAO.deleteTable(TABLE_ID)).rejects.toThrow('Cannot delete a table that is scheduled in a slot or has active reservations');
        expect(prismaMock.table.delete).not.toHaveBeenCalled();
    });

    it('throws if the table is scheduled in a slot', async () => {
        prismaMock.reservation_table.findFirst.mockResolvedValue(null);
        prismaMock.slot_table.findFirst.mockResolvedValue({ table_id: TABLE_ID });
        prismaMock.table.delete.mockResolvedValue({ table_id: TABLE_ID });

        await expect(TableDAO.deleteTable(TABLE_ID)).rejects.toThrow('Cannot delete a table that is scheduled in a slot or has active reservations');
        expect(prismaMock.table.delete).not.toHaveBeenCalled();
    });

    it('throws if the table has active reservations and is scheduled in a slot', async () => {
        prismaMock.reservation_table.findFirst.mockResolvedValue({ table_id: TABLE_ID });
        prismaMock.slot_table.findFirst.mockResolvedValue({ table_id: TABLE_ID });
        prismaMock.table.delete.mockResolvedValue({ table_id: TABLE_ID });

        await expect(TableDAO.deleteTable(TABLE_ID)).rejects.toThrow('Cannot delete a table that is scheduled in a slot or has active reservations');
        expect(prismaMock.table.delete).not.toHaveBeenCalled();
    });
});