// MH-05 - Party requirements: unit tests of the validation of the requirements list
// in POST /api/slots/:slotId/reservations (booking) and PUT /api/reservations/:reservationId (change booking)
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const reservationDaoMock = {
    saveReservation: jest.fn(),
    updateReservation: jest.fn(),
    getReservationDetails: jest.fn(),
};

const confirmationMock = {
    sendReservationConfirmation: jest.fn(),
};

class ReservationError extends Error { constructor(code, message) { super(message); this.code = code; } }
jest.unstable_mockModule('../../dao/ReservationDAO.js', () => ({ default: reservationDaoMock, ReservationError }));
jest.unstable_mockModule('../../services/reservationConfirmation.js', () => confirmationMock);

const { default: reservationRoutes } = await import('../../routes/reservations.js');

// The "x-test-role" header replaces the passport session (as in reservations.unit.test.js)
const USER_ID = '33333333-3333-4333-8333-333333333333';
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    const role = req.get('x-test-role');
    req.isAuthenticated = () => Boolean(role);
    req.user = role ? { user_id: USER_ID, role } : undefined;
    next();
});
app.use('/api', reservationRoutes);

const SLOT_ID = '11111111-1111-4111-8111-111111111111';
const RESERVATION_ID = '44444444-4444-4444-8444-444444444444';
const bookingUrl = `/api/slots/${SLOT_ID}/reservations`;
const changeUrl = `/api/reservations/${RESERVATION_ID}`;

// Example of the user story: three requirements for subsets of the party
const STORY_EXAMPLE = [
    { allergies: true, description: '1 vegan, peanut allergy' },
    { allergies: true, description: '1 shellfish allergy' },
    { allergies: false, description: '2 vegetarians' },
];

const book = (body) => request(app).post(bookingUrl).set('x-test-role', 'hiker').send(body);
const change = (body) => request(app).put(changeUrl).set('x-test-role', 'hiker').send(body);

// Entries that are not a valid requirement
const INVALID_ENTRIES = [
    ['null', null],
    ['a text', 'nuts'],
    ['a list', [true, 'nuts']],
    ['without allergies', { description: 'nuts' }],
    ['with allergies as a text', { allergies: 'true', description: 'nuts' }],
    ['with allergies as a number', { allergies: 1, description: 'nuts' }],
    ['without description', { allergies: true }],
    ['with a description that is not a text', { allergies: true, description: 42 }],
    ['with an empty description', { allergies: true, description: '' }],
    ['with a description of only spaces', { allergies: true, description: '   ' }],
];

beforeEach(() => {
    jest.resetAllMocks();
    reservationDaoMock.saveReservation.mockResolvedValue({ reservation_id: RESERVATION_ID });
    reservationDaoMock.updateReservation.mockResolvedValue({ changed: true });
    reservationDaoMock.getReservationDetails.mockResolvedValue({ reservation_id: RESERVATION_ID });
    confirmationMock.sendReservationConfirmation.mockResolvedValue({ messageId: 'id' });
});

describe('POST /api/slots/:slotId/reservations - list of party requirements', () => {
    it('passes the requirements of the user story example to the DAO', async () => {
        await book({ people: 4, requirements: STORY_EXAMPLE }).expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 4, STORY_EXAMPLE);
    });

    it('trims every description and keeps only allergies and description of each entry', async () => {
        await book({
            people: 2,
            requirements: [
                { allergies: true, description: '  1 shellfish allergy  ', extra: 'ignored' },
                { allergies: false, description: '\t1 vegetarian\n' },
            ],
        }).expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 2, [
            { allergies: true, description: '1 shellfish allergy' },
            { allergies: false, description: '1 vegetarian' },
        ]);
    });

    it('accepts as many requirements as people (one for each person)', async () => {
        await book({ people: 2, requirements: STORY_EXAMPLE.slice(0, 2) }).expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledTimes(1);
    });

    it('responds 422 and saves nothing if there are more requirements than people', async () => {
        const res = await book({ people: 2, requirements: STORY_EXAMPLE }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it.each(INVALID_ENTRIES)('responds 422 and saves nothing if an entry is %s', async (_, entry) => {
        const res = await book({ people: 4, requirements: [STORY_EXAMPLE[0], entry] }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });
});

describe('PUT /api/reservations/:reservationId - list of party requirements', () => {
    it('passes the new list of requirements to the DAO', async () => {
        await change({ slot_id: SLOT_ID, people: 4, requirements: STORY_EXAMPLE }).expect(200);

        expect(reservationDaoMock.updateReservation).toHaveBeenCalledWith(
            RESERVATION_ID, USER_ID, { slotId: SLOT_ID, people: 4, requirements: STORY_EXAMPLE },
        );
    });

    it('passes an empty list to remove all the requirements', async () => {
        await change({ slot_id: SLOT_ID, people: 4, requirements: [] }).expect(200);

        expect(reservationDaoMock.updateReservation).toHaveBeenCalledWith(
            RESERVATION_ID, USER_ID, expect.objectContaining({ requirements: [] }),
        );
    });

    it('responds 422 if there are more requirements than the new party size', async () => {
        const res = await change({ slot_id: SLOT_ID, people: 2, requirements: STORY_EXAMPLE }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        expect(reservationDaoMock.updateReservation).not.toHaveBeenCalled();
    });

    it('reports only people when the party size is not a number', async () => {
        const res = await change({ slot_id: SLOT_ID, people: 'abc', requirements: STORY_EXAMPLE }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['people']);
    });

    it.each(INVALID_ENTRIES)('responds 422 and changes nothing if an entry is %s', async (_, entry) => {
        const res = await change({ slot_id: SLOT_ID, people: 4, requirements: [STORY_EXAMPLE[0], entry] }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        expect(reservationDaoMock.updateReservation).not.toHaveBeenCalled();
    });
});
