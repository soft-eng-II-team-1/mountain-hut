// MH-06 - Change a booking: unit tests of ReservationDAO.updateReservation
import { jest } from '@jest/globals';

// Transaction client mock: the same object is passed as "tx" to the $transaction callback
const tx = {
    slot: { findUnique: jest.fn() },
    slot_table: { findMany: jest.fn() },
    reservation: { findFirst: jest.fn(), update: jest.fn() },
    reservation_table: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
    },
};

const prismaMock = { $transaction: jest.fn() };

jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: ReservationDAO } = await import('../../dao/ReservationDAO.js');

const HOUR = 60 * 60 * 1000;
const RES_ID = 'res-1';
const USER_ID = 'user-1';
const SLOT_ID = 'slot-1';
const NEW_SLOT_ID = 'slot-2';

// Tables of a slot, as returned by slot_table.findMany({ include: { table: true } })
const slotTables = (...list) => list.map(([number, seats]) => ({
    table_id: `id-${number}`,
    table: { number, seats },
}));

// Rows of reservation_table: [table, seats] -> { id, table_id, seats_reserved }
const rows = (...list) => list.map(([number, seats_reserved]) => ({
    id: `row-${number}`,
    table_id: `id-${number}`,
    seats_reserved,
}));

// Current slot: T1(4) T2(2) T3(6). New slot: T4(4) T5(6), empty, starting in 4 days.
// The reservation starts in 3 days; `taken` are all the seats reserved in the current slot (own included)
const setup = ({ people = 3, requirements = null, own = rows(['T1', 3]), taken = own, startsIn = 72 * HOUR } = {}) => {
    tx.reservation.findFirst.mockImplementation(async ({ where }) => (
        where.reservation_id === RES_ID
            ? {
                reservation_id: RES_ID, user_id: USER_ID, slot_id: SLOT_ID, people, requirements,
                slot: { date_time_start: new Date(Date.now() + startsIn) },
                reservation_table: own,
            }
            : null
    ));
    tx.slot.findUnique.mockResolvedValue({ slot_id: NEW_SLOT_ID, date_time_start: new Date(Date.now() + 96 * HOUR) });
    tx.slot_table.findMany.mockImplementation(async ({ where }) => (
        where.slot_id === SLOT_ID ? slotTables(['T1', 4], ['T2', 2], ['T3', 6]) : slotTables(['T4', 4], ['T5', 6])
    ));
    // Seats released with deleteMany are free again, like in the DB transaction
    let released = false;
    tx.reservation_table.deleteMany.mockImplementation(async () => { released = true; });
    tx.reservation_table.findMany.mockImplementation(async ({ where }) => (
        where.reservation.slot_id === SLOT_ID && !released ? taken : []
    ));
};

const update = (changes) => ReservationDAO.updateReservation(RES_ID, USER_ID, {
    slotId: SLOT_ID, people: 3, requirements: null, ...changes,
});

// Tables saved with createMany, as { table: seats }
const createdTables = () => Object.fromEntries(
    tx.reservation_table.createMany.mock.calls[0][0].data.map((r) => [r.table_id.slice(3), r.seats_reserved]),
);

const expectNothingSaved = () => {
    expect(tx.reservation.update).not.toHaveBeenCalled();
    expect(tx.reservation_table.createMany).not.toHaveBeenCalled();
    expect(tx.reservation_table.deleteMany).not.toHaveBeenCalled();
    expect(tx.reservation_table.update).not.toHaveBeenCalled();
};

beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
});

describe('ReservationDAO.updateReservation - checks on the current reservation', () => {
    it('throws NOT_FOUND if the reservation is not one of the hiker', async () => {
        setup();
        tx.reservation.findFirst.mockResolvedValue(null);

        await expect(update({ people: 2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        expect(tx.reservation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { reservation_id: RES_ID, user_id: USER_ID },
        }));
    });

    it('throws TOO_LATE if the slot starts in less than 48 hours', async () => {
        setup({ startsIn: 47 * HOUR });

        await expect(update({ people: 2 })).rejects.toMatchObject({ code: 'TOO_LATE' });
        expectNothingSaved();
    });

    it('returns changed: false and saves nothing if the request changes nothing', async () => {
        setup({ requirements: 'Vegan' });

        await expect(update({ requirements: 'Vegan' })).resolves.toEqual({ changed: false });
        expectNothingSaved();
    });
});

describe('ReservationDAO.updateReservation - same slot', () => {
    it('changes only the requirements and keeps the tables', async () => {
        setup();

        await expect(update({ requirements: 'One vegetarian' })).resolves.toEqual({ changed: true });

        expect(tx.reservation.update).toHaveBeenCalledWith({
            where: { reservation_id: RES_ID },
            data: { slot_id: SLOT_ID, people: 3, requirements: 'One vegetarian' },
        });
        expect(tx.reservation_table.update).not.toHaveBeenCalled();
        expect(tx.reservation_table.deleteMany).not.toHaveBeenCalled();
    });

    it('removes seats starting from the table with fewer people when the party gets smaller', async () => {
        // 9 people: T1 4, T2 2, T3 3 -> 6: T2 is released, T3 goes to 2, T1 untouched
        setup({ people: 9, own: rows(['T1', 4], ['T2', 2], ['T3', 3]) });

        await update({ people: 6 });

        expect(tx.reservation_table.delete).toHaveBeenCalledWith({ where: { id: 'row-T2' } });
        expect(tx.reservation_table.update).toHaveBeenCalledTimes(1);
        expect(tx.reservation_table.update).toHaveBeenCalledWith({ where: { id: 'row-T3' }, data: { seats_reserved: 2 } });
    });

    it('uses the free seats of its own tables when the party gets bigger', async () => {
        // 4 people: T1 2 (2 free), T3 2 (4 free) -> 5: the extra person goes to T3
        setup({ people: 4, own: rows(['T1', 2], ['T3', 2]) });

        await update({ people: 5 });

        expect(tx.reservation_table.update).toHaveBeenCalledTimes(1);
        expect(tx.reservation_table.update).toHaveBeenCalledWith({ where: { id: 'row-T3' }, data: { seats_reserved: 3 } });
        expect(tx.reservation_table.createMany).not.toHaveBeenCalled();
    });

    it('assigns the tables again (MH-01 rules) when the bigger party does not fit at its tables', async () => {
        // 3 people at T1 (4 seats) -> 5: seats released, the best table is T3 (6)
        setup();

        await update({ people: 5 });

        expect(tx.reservation_table.deleteMany).toHaveBeenCalledWith({ where: { reservation_id: RES_ID } });
        expect(createdTables()).toEqual({ T3: 5 });
    });

    it('throws INSUFFICIENT_SEATS and saves nothing when the slot has not enough free seats', async () => {
        // Only 1 free seat in the slot (T1), the party wants 2 more
        setup({ taken: [...rows(['T1', 3]), ...rows(['T2', 2], ['T3', 6])] });

        await expect(update({ people: 5 })).rejects.toMatchObject({ code: 'INSUFFICIENT_SEATS' });
        expectNothingSaved();
    });
});

describe('ReservationDAO.updateReservation - new slot', () => {
    it('moves the reservation and assigns the tables of the new slot', async () => {
        setup();

        await expect(update({ slotId: NEW_SLOT_ID, people: 8 })).resolves.toEqual({ changed: true });

        expect(tx.reservation_table.deleteMany).toHaveBeenCalledWith({ where: { reservation_id: RES_ID } });
        expect(createdTables()).toEqual({ T5: 6, T4: 2 });
        expect(tx.reservation.update).toHaveBeenCalledWith({
            where: { reservation_id: RES_ID },
            data: { slot_id: NEW_SLOT_ID, people: 8, requirements: null },
        });
    });

    it('throws SLOT_NOT_FOUND if the new slot does not exist', async () => {
        setup();
        tx.slot.findUnique.mockResolvedValue(null);

        await expect(update({ slotId: NEW_SLOT_ID })).rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
    });

    it('throws TOO_LATE if the new slot starts in less than 2 hours', async () => {
        setup();
        tx.slot.findUnique.mockResolvedValue({ slot_id: NEW_SLOT_ID, date_time_start: new Date(Date.now() + HOUR) });

        await expect(update({ slotId: NEW_SLOT_ID })).rejects.toMatchObject({ code: 'TOO_LATE' });
        expectNothingSaved();
    });

    it('throws ALREADY_BOOKED if the hiker already has a reservation in the new slot', async () => {
        setup();
        tx.reservation.findFirst
            .mockImplementationOnce(tx.reservation.findFirst.getMockImplementation())
            .mockResolvedValueOnce({ reservation_id: 'res-2' });

        await expect(update({ slotId: NEW_SLOT_ID })).rejects.toMatchObject({ code: 'ALREADY_BOOKED' });
        expectNothingSaved();
    });

    it('throws INSUFFICIENT_SEATS if the new slot has not enough free seats', async () => {
        setup();
        tx.slot_table.findMany.mockResolvedValue(slotTables(['T4', 2]));

        await expect(update({ slotId: NEW_SLOT_ID })).rejects.toMatchObject({ code: 'INSUFFICIENT_SEATS' });
        expect(tx.reservation_table.createMany).not.toHaveBeenCalled();
        expect(tx.reservation.update).not.toHaveBeenCalled();
    });
});

it('throws CONCURRENT_UPDATE when the transaction keeps colliding with other bookings', async () => {
    setup();
    prismaMock.$transaction.mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }));

    await expect(update({ people: 2 })).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
});
