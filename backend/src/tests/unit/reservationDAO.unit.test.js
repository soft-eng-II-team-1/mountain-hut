import { jest } from '@jest/globals';

// Transaction client mock: the same object is used as "tx" inside $transaction
const tx = {
    slot: { findUnique: jest.fn() },
    slot_table: { findMany: jest.fn() },
    reservation: { findFirst: jest.fn(), create: jest.fn() },
    reservation_table: { findMany: jest.fn(), createMany: jest.fn() },
};

const prismaMock = {
    ...tx,
    $transaction: jest.fn(),
};

// Prisma mock
jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: ReservationDAO } = await import('../../dao/ReservationDAO.js');

const HOUR = 60 * 60 * 1000;
const SLOT_ID = 'slot-1';
const USER_ID = 'user-1';

// Slot tables as returned by prisma.slot_table.findMany({ include: { table: true } })
const slotTables = (...list) => list.map(([number, seats]) => ({
    slot_id: SLOT_ID,
    table_id: `id-${number}`,
    table: { table_id: `id-${number}`, number, seats },
}));

// Existing reservations as returned by prisma.reservation_table.findMany
const reserved = (...list) => list.map(([number, seats_reserved]) => ({
    table_id: `id-${number}`,
    seats_reserved,
}));

// Sets up a valid scenario: slot in 3 days, no previous booking, tables T1(4) T2(2) T3(6) empty
const setupValidBooking = () => {
    tx.slot.findUnique.mockResolvedValue({
        slot_id: SLOT_ID,
        date_time_start: new Date(Date.now() + 72 * HOUR),
        date_time_end: new Date(Date.now() + 73 * HOUR),
    });
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.slot_table.findMany.mockResolvedValue(slotTables(['T1', 4], ['T2', 2], ['T3', 6]));
    tx.reservation_table.findMany.mockResolvedValue([]);
    tx.reservation.create.mockImplementation(async ({ data }) => data);
    tx.reservation_table.createMany.mockResolvedValue({ count: 1 });
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    // By default the transaction just runs the callback with the tx mock
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
});

describe('ReservationDAO.checkAvailability', () => {
    it('subtracts the reserved seats from each table', async () => {
        tx.slot_table.findMany.mockResolvedValue(slotTables(['T1', 4], ['T2', 6]));
        tx.reservation_table.findMany.mockResolvedValue(reserved(['T1', 1], ['T2', 2], ['T2', 1]));

        const result = await ReservationDAO.checkAvailability(SLOT_ID, 2, tx);

        expect(result.available).toBe(true);
        expect(result.totalAvailableSeats).toBe(6);
        expect(result.availableTables).toEqual([
            { table_id: 'id-T1', number: 'T1', remainingSeats: 3 },
            { table_id: 'id-T2', number: 'T2', remainingSeats: 3 },
        ]);
    });

    it('does not return full tables', async () => {
        tx.slot_table.findMany.mockResolvedValue(slotTables(['T1', 2], ['T2', 4]));
        tx.reservation_table.findMany.mockResolvedValue(reserved(['T1', 2]));

        const result = await ReservationDAO.checkAvailability(SLOT_ID, 1, tx);

        expect(result.availableTables.map((t) => t.number)).toEqual(['T2']);
    });

    it('is available when the party equals the free seats', async () => {
        tx.slot_table.findMany.mockResolvedValue(slotTables(['T1', 4], ['T2', 2]));
        tx.reservation_table.findMany.mockResolvedValue(reserved(['T1', 1]));

        const result = await ReservationDAO.checkAvailability(SLOT_ID, 5, tx);

        expect(result.available).toBe(true);
        expect(result.totalAvailableSeats).toBe(5);
    });

    it('is not available when the party exceeds the free seats by one', async () => {
        tx.slot_table.findMany.mockResolvedValue(slotTables(['T1', 4], ['T2', 2]));
        tx.reservation_table.findMany.mockResolvedValue(reserved(['T1', 1]));

        const result = await ReservationDAO.checkAvailability(SLOT_ID, 6, tx);

        expect(result).toEqual({ available: false, totalAvailableSeats: 5, availableTables: [] });
    });

    it('throws if the slot has no tables', async () => {
        tx.slot_table.findMany.mockResolvedValue([]);

        await expect(ReservationDAO.checkAvailability(SLOT_ID, 1, tx))
            .rejects.toThrow('No tables are assigned to this slot yet.');
    });

    it('uses the global prisma client when no transaction is given', async () => {
        prismaMock.slot_table.findMany.mockResolvedValue(slotTables(['T1', 4]));
        prismaMock.reservation_table.findMany.mockResolvedValue([]);

        await ReservationDAO.checkAvailability(SLOT_ID, 1);

        expect(prismaMock.slot_table.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { slot_id: SLOT_ID } }),
        );
    });
});

describe('ReservationDAO.saveReservation - success', () => {
    it('creates the reservation and its tables', async () => {
        setupValidBooking();

        const result = await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 3);

        expect(tx.reservation.create).toHaveBeenCalledTimes(1);
        const { data } = tx.reservation.create.mock.calls[0][0];
        expect(data).toMatchObject({ people: 3, slot_id: SLOT_ID, user_id: USER_ID });
        expect(data.reservation_id).toEqual(expect.any(String));

        // Best fit: the whole party at T1 (4 seats)
        const rows = tx.reservation_table.createMany.mock.calls[0][0].data;
        expect(rows).toEqual([
            expect.objectContaining({ reservation_id: data.reservation_id, table_id: 'id-T1', seats_reserved: 3 }),
        ]);

        expect(result).toMatchObject({ people: 3, slot_id: SLOT_ID, user_id: USER_ID });
        expect(result.tables).toEqual([{ table_id: 'id-T1', number: 'T1', seats_reserved: 3 }]);
    });

    it('splits the party over more tables when needed', async () => {
        setupValidBooking();

        const result = await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 8);

        // No table has 8 seats: T3 (6) + T2 (2)
        expect(result.tables).toEqual([
            { table_id: 'id-T3', number: 'T3', seats_reserved: 6 },
            { table_id: 'id-T2', number: 'T2', seats_reserved: 2 },
        ]);
        const rows = tx.reservation_table.createMany.mock.calls[0][0].data;
        expect(rows.reduce((sum, r) => sum + r.seats_reserved, 0)).toBe(8);
    });

    it('runs inside a SERIALIZABLE transaction', async () => {
        setupValidBooking();

        await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2);

        expect(prismaMock.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            { isolationLevel: 'Serializable' },
        );
    });

    it('reads availability through the transaction client', async () => {
        setupValidBooking();

        await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2);

        expect(tx.slot_table.findMany).toHaveBeenCalled();
        expect(tx.reservation_table.findMany).toHaveBeenCalled();
    });
});

describe('ReservationDAO.saveReservation - business rules', () => {
    it('throws if the slot does not exist', async () => {
        setupValidBooking();
        tx.slot.findUnique.mockResolvedValue(null);

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2)).rejects.toThrow('Slot not found');
        expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('throws if the slot starts in less than 2 hours', async () => {
        setupValidBooking();
        tx.slot.findUnique.mockResolvedValue({ slot_id: SLOT_ID, date_time_start: new Date(Date.now() + HOUR) });

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2))
            .rejects.toThrow('Reservations must be made at least 2 hours before the slot starts');
        expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('throws if the slot has already started', async () => {
        setupValidBooking();
        tx.slot.findUnique.mockResolvedValue({ slot_id: SLOT_ID, date_time_start: new Date(Date.now() - HOUR) });

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2))
            .rejects.toThrow('Reservations must be made at least 2 hours before the slot starts');
    });

    it('accepts a booking exactly 2 hours before the slot starts', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-10T10:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
        setupValidBooking();
        tx.slot.findUnique.mockResolvedValue({ slot_id: SLOT_ID, date_time_start: new Date('2026-11-10T12:00:00Z') });

        const result = await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2);

        expect(result.people).toBe(2);
    });

    it('rejects a booking 1 millisecond after the 2 hours limit', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-10T10:00:00.001Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
        setupValidBooking();
        tx.slot.findUnique.mockResolvedValue({ slot_id: SLOT_ID, date_time_start: new Date('2026-11-10T12:00:00Z') });

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2))
            .rejects.toThrow('Reservations must be made at least 2 hours before the slot starts');
    });

    it('throws if the hiker already has a reservation for the slot', async () => {
        setupValidBooking();
        tx.reservation.findFirst.mockResolvedValue({ reservation_id: 'r-1', slot_id: SLOT_ID, user_id: USER_ID });

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2))
            .rejects.toThrow('You already have a reservation for this time slot');
        expect(tx.reservation.findFirst).toHaveBeenCalledWith({ where: { slot_id: SLOT_ID, user_id: USER_ID } });
        expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('throws if the slot has no tables', async () => {
        setupValidBooking();
        tx.slot_table.findMany.mockResolvedValue([]);

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2))
            .rejects.toThrow('No tables are assigned to this slot yet.');
    });

    it('throws if there are not enough free seats', async () => {
        setupValidBooking();
        // 12 seats in total, 10 already taken
        tx.reservation_table.findMany.mockResolvedValue(reserved(['T1', 4], ['T3', 6]));

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 3))
            .rejects.toThrow('Insufficient seats available for this party size');
        expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('accepts a party that takes exactly the last free seats', async () => {
        setupValidBooking();
        tx.reservation_table.findMany.mockResolvedValue(reserved(['T1', 4], ['T3', 6]));

        const result = await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2);

        expect(result.tables).toEqual([{ table_id: 'id-T2', number: 'T2', seats_reserved: 2 }]);
    });
});

describe('ReservationDAO.saveReservation - concurrency retries', () => {
    const conflict = () => Object.assign(new Error('Transaction failed due to a write conflict'), { code: 'P2034' });

    it('retries when the transaction fails with a serialization conflict (P2034)', async () => {
        setupValidBooking();
        prismaMock.$transaction
            .mockRejectedValueOnce(conflict())
            .mockImplementationOnce(async (callback) => callback(tx));

        const result = await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
        expect(result.people).toBe(2);
    });

    it('gives up after 3 conflicting attempts', async () => {
        setupValidBooking();
        prismaMock.$transaction.mockRejectedValue(conflict());

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2))
            .rejects.toThrow('The slot is being booked by other hikers, please try again');
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
    });

    it('does not retry other errors', async () => {
        setupValidBooking();
        prismaMock.$transaction.mockRejectedValue(new Error('DB down'));

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2)).rejects.toThrow('DB down');
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not retry business errors', async () => {
        setupValidBooking();
        tx.slot.findUnique.mockResolvedValue(null);

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 2)).rejects.toThrow('Slot not found');
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
});