// MH-05 - Party requirements: unit tests of how ReservationDAO saves, replaces and reads the requirements
import { jest } from '@jest/globals';

// Transaction client mock: the same object is passed as "tx" to the $transaction callback
const tx = {
    slot: { findUnique: jest.fn() },
    slot_table: { findMany: jest.fn() },
    reservation: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    reservation_table: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
};

const prismaMock = {
    reservation: { findUnique: jest.fn() },
    $transaction: jest.fn(),
};

jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: ReservationDAO } = await import('../../dao/ReservationDAO.js');

const HOUR = 60 * 60 * 1000;
const RES_ID = 'res-1';
const USER_ID = 'user-1';
const SLOT_ID = 'slot-1';

// Example of the user story: three requirements for subsets of the party
const STORY_EXAMPLE = [
    { allergies: true, description: '1 vegan, peanut allergy' },
    { allergies: true, description: '1 shellfish allergy' },
    { allergies: false, description: '2 vegetarians' },
];
const NO_ALLERGIES = [{ allergies: false, description: '2 vegetarians' }];
// The same list in the order of every response and of the email: allergies first
const STORY_EXAMPLE_SORTED = [STORY_EXAMPLE[1], STORY_EXAMPLE[0], STORY_EXAMPLE[2]];

// Booking that can be saved: slot in 3 days, one empty table of 6 seats
const setupBooking = () => {
    tx.slot.findUnique.mockResolvedValue({ slot_id: SLOT_ID, date_time_start: new Date(Date.now() + 72 * HOUR) });
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.slot_table.findMany.mockResolvedValue([{ table_id: 'id-T1', table: { number: 'T1', seats: 6 } }]);
    tx.reservation_table.findMany.mockResolvedValue([]);
    tx.reservation.create.mockImplementation(async ({ data }) => data);
};

// Reservation of 4 people in 3 days, with the given requirements, as read by updateReservation
const setupReservation = (requirements) => {
    tx.reservation.findFirst.mockResolvedValue({
        reservation_id: RES_ID, user_id: USER_ID, slot_id: SLOT_ID, people: 4,
        slot: { date_time_start: new Date(Date.now() + 72 * HOUR) },
        reservation_table: [{ id: 'row-T1', table_id: 'id-T1', seats_reserved: 4 }],
        reservation_requirement: requirements,
    });
};

const update = (requirements) => ReservationDAO.updateReservation(RES_ID, USER_ID, { slotId: SLOT_ID, people: 4, requirements });

// `data` passed to tx.reservation.create / tx.reservation.update
const createdData = () => tx.reservation.create.mock.calls[0][0].data;
const updatedData = () => tx.reservation.update.mock.calls[0][0].data;

// Requirements without the generated ids
const withoutIds = (rows) => rows.map(({ allergies, description }) => ({ allergies, description }));

beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
});

describe('ReservationDAO.saveReservation - party requirements', () => {
    it('saves every requirement in the same transaction as the reservation', async () => {
        setupBooking();

        await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 4, STORY_EXAMPLE);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        const rows = createdData().reservation_requirement.create;
        expect(withoutIds(rows)).toEqual(STORY_EXAMPLE);
        // every row has its own id
        expect(new Set(rows.map((r) => r.id)).size).toBe(STORY_EXAMPLE.length);
    });

    it('sets has_allergies when at least one requirement has allergies', async () => {
        setupBooking();

        await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 4, STORY_EXAMPLE);

        expect(createdData().has_allergies).toBe(true);
    });

    it.each([
        ['no requirement has allergies', NO_ALLERGIES],
        ['there are no requirements', []],
    ])('does not set has_allergies when %s', async (_, requirements) => {
        setupBooking();

        await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 4, requirements);

        expect(createdData().has_allergies).toBe(false);
        expect(withoutIds(createdData().reservation_requirement.create)).toEqual(requirements);
    });

    it('saves no requirements when none are given', async () => {
        setupBooking();

        await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 4);

        expect(createdData().reservation_requirement.create).toEqual([]);
    });

    it('returns the requirements in the same order as the reservation details (allergies first)', async () => {
        setupBooking();

        const result = await ReservationDAO.saveReservation(USER_ID, SLOT_ID, 4, [...STORY_EXAMPLE].reverse());

        expect(result.requirements).toEqual(STORY_EXAMPLE_SORTED);
    });

    it('saves no requirements when the booking fails', async () => {
        setupBooking();
        tx.slot_table.findMany.mockResolvedValue([{ table_id: 'id-T1', table: { number: 'T1', seats: 2 } }]);

        await expect(ReservationDAO.saveReservation(USER_ID, SLOT_ID, 4, STORY_EXAMPLE))
            .rejects.toThrow('Insufficient seats available for this party size');
        expect(tx.reservation.create).not.toHaveBeenCalled();
    });
});

describe('ReservationDAO.updateReservation - party requirements', () => {
    it('does nothing if the same requirements are sent in a different order', async () => {
        setupReservation(STORY_EXAMPLE);

        await expect(update([...STORY_EXAMPLE].reverse())).resolves.toEqual({ changed: false });
        expect(tx.reservation.update).not.toHaveBeenCalled();
    });

    it('replaces the whole list and recalculates has_allergies', async () => {
        setupReservation(STORY_EXAMPLE);

        await expect(update(NO_ALLERGIES)).resolves.toEqual({ changed: true });

        const data = updatedData();
        expect(data.has_allergies).toBe(false);
        expect(data.reservation_requirement.deleteMany).toEqual({});
        expect(withoutIds(data.reservation_requirement.create)).toEqual(NO_ALLERGIES);
    });

    it('detects a change of the allergies flag only', async () => {
        setupReservation(NO_ALLERGIES);

        await expect(update([{ allergies: true, description: '2 vegetarians' }])).resolves.toEqual({ changed: true });
        expect(updatedData().has_allergies).toBe(true);
    });

    it('removes all the requirements with an empty list', async () => {
        setupReservation(STORY_EXAMPLE);

        await expect(update([])).resolves.toEqual({ changed: true });

        expect(updatedData()).toMatchObject({
            has_allergies: false,
            reservation_requirement: { deleteMany: {}, create: [] },
        });
    });

    it('keeps the tables when only the requirements change', async () => {
        setupReservation([]);

        await update(STORY_EXAMPLE);

        expect(tx.reservation_table.deleteMany).not.toHaveBeenCalled();
        expect(tx.reservation_table.createMany).not.toHaveBeenCalled();
    });
});

describe('ReservationDAO.getReservationDetails - party requirements', () => {
    const reservation = (requirements, hasAllergies) => ({
        reservation_id: RES_ID,
        people: 4,
        has_allergies: hasAllergies,
        reservation_requirement: requirements,
        slot: { slot_id: SLOT_ID, date_time_start: new Date(), date_time_end: new Date() },
        user: { user_id: USER_ID, name: 'Mario', surname: 'Rossi', email: 'mario.rossi@example.com' },
        reservation_table: [],
    });

    it('returns the requirements with the allergies first and has_allergies', async () => {
        prismaMock.reservation.findUnique.mockResolvedValue(reservation([...STORY_EXAMPLE].reverse(), true));

        const details = await ReservationDAO.getReservationDetails(RES_ID);

        expect(details.requirements).toEqual(STORY_EXAMPLE_SORTED);
        expect(details.has_allergies).toBe(true);
    });

    it('derives has_allergies from the list, not from the stored flag', async () => {
        // e.g. a reservation migrated with the flag set but no requirement text
        prismaMock.reservation.findUnique.mockResolvedValue(reservation([], true));

        const details = await ReservationDAO.getReservationDetails(RES_ID);

        expect(details.has_allergies).toBe(false);
    });

    it('returns an empty list when there are no requirements', async () => {
        prismaMock.reservation.findUnique.mockResolvedValue(reservation([], false));

        const details = await ReservationDAO.getReservationDetails(RES_ID);

        expect(details.requirements).toEqual([]);
        expect(details.has_allergies).toBe(false);
    });
});
