import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ReservationDAO mock: the router uses the static methods of the class
const reservationDaoMock = {
    checkAvailability: jest.fn(),
    saveReservation: jest.fn(),
    getReservationDetails: jest.fn(),
};

// Confirmation service mock: no email is built or sent
const confirmationMock = {
    sendReservationConfirmation: jest.fn(),
    buildConfirmationEmail: jest.fn(),
};

class ReservationError extends Error { constructor(code, message) { super(message); this.code = code; } }
jest.unstable_mockModule('../../dao/ReservationDAO.js', () => ({ default: reservationDaoMock, ReservationError }));
jest.unstable_mockModule('../../services/reservationConfirmation.js', () => confirmationMock);

const { default: reservationRoutes } = await import('../../routes/reservations.js');

// Small app with only the reservation routes. The "x-test-role" header replaces the passport session,
// so the real isLoggedIn and isHiker middlewares are used without logging in
const USER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '77777777-7777-4777-8777-777777777777';
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
const TABLE_ID = '22222222-2222-4222-8222-222222222222';
const RESERVATION_ID = '44444444-4444-4444-8444-444444444444';
const availabilityUrl = `/api/slots/${SLOT_ID}/availability`;
const bookingUrl = `/api/slots/${SLOT_ID}/reservations`;
const detailsUrl = `/api/reservations/${RESERVATION_ID}`;
const resendUrl = `/api/reservations/${RESERVATION_ID}/confirmation`;

const availability = {
    available: true,
    totalAvailableSeats: 6,
    availableTables: [{ table_id: TABLE_ID, number: 'T1', remainingSeats: 6 }],
};

const reservation = {
    reservation_id: RESERVATION_ID,
    people: 3,
    requirements: null,
    slot_id: SLOT_ID,
    user_id: USER_ID,
    tables: [{ table_id: TABLE_ID, number: 'T1', seats_reserved: 3 }],
};

// Output of ReservationDAO.getReservationDetails
const details = (userId = USER_ID) => ({
    reservation_id: RESERVATION_ID,
    people: 3,
    requirements: 'Nut allergy',
    slot: {
        slot_id: SLOT_ID,
        date_time_start: '2030-07-01T12:00:00.000Z',
        date_time_end: '2030-07-01T13:00:00.000Z',
    },
    hiker: { user_id: userId, name: 'Anna', surname: 'Bianchi', email: 'anna@example.com' },
    tables: [{ table_id: TABLE_ID, number: 'T1', seats_reserved: 3 }],
});

// Booking that succeeds and whose confirmation is sent
const setupSuccessfulBooking = () => {
    reservationDaoMock.saveReservation.mockResolvedValue(reservation);
    reservationDaoMock.getReservationDetails.mockResolvedValue(details());
    confirmationMock.sendReservationConfirmation.mockResolvedValue({ messageId: 'id' });
};

let consoleErrorSpy;

beforeEach(() => {
    jest.resetAllMocks();
    // The routes log the email failures: keep the test output clean
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('GET /api/slots/:slotId/availability', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).get(`${availabilityUrl}?partySize=2`).expect(401);

        expect(reservationDaoMock.checkAvailability).not.toHaveBeenCalled();
    });

    it.each(['hiker', 'employee', 'warden'])('is available to any logged in user (%s)', async (role) => {
        reservationDaoMock.checkAvailability.mockResolvedValue(availability);

        await request(app).get(`${availabilityUrl}?partySize=2`).set('x-test-role', role).expect(200);
    });

    it('returns the availability and passes partySize as a number', async () => {
        reservationDaoMock.checkAvailability.mockResolvedValue(availability);

        const res = await request(app).get(`${availabilityUrl}?partySize=2`).set('x-test-role', 'hiker').expect(200);

        expect(res.body).toEqual(availability);
        expect(reservationDaoMock.checkAvailability).toHaveBeenCalledWith(SLOT_ID, 2);
    });

    it('responds 400 if there are not enough seats', async () => {
        reservationDaoMock.checkAvailability.mockResolvedValue({ available: false, totalAvailableSeats: 1, availableTables: [] });

        const res = await request(app).get(`${availabilityUrl}?partySize=2`).set('x-test-role', 'hiker').expect(400);

        expect(res.body).toEqual({ error: 'Insufficient seats available for this party size' });
    });

    it('responds 422 if the slot id is not a UUID', async () => {
        const res = await request(app).get('/api/slots/abc/availability?partySize=2').set('x-test-role', 'hiker').expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['slotId']);
        expect(reservationDaoMock.checkAvailability).not.toHaveBeenCalled();
    });

    it.each(['', '?partySize=0', '?partySize=-1', '?partySize=1.5', '?partySize=abc'])(
        'responds 422 if partySize is not a positive integer (%s)',
        async (query) => {
            const res = await request(app).get(`${availabilityUrl}${query}`).set('x-test-role', 'hiker').expect(422);

            expect(res.body.errors.map((e) => e.field)).toEqual(['partySize']);
            expect(reservationDaoMock.checkAvailability).not.toHaveBeenCalled();
        },
    );

    it('responds 404 if the slot has no tables', async () => {
        reservationDaoMock.checkAvailability.mockRejectedValue(new Error('No tables are assigned to this slot yet.'));

        const res = await request(app).get(`${availabilityUrl}?partySize=2`).set('x-test-role', 'hiker').expect(404);

        expect(res.body).toEqual({ error: 'No tables are assigned to this slot yet.' });
    });

    it('responds 500 on unexpected errors', async () => {
        reservationDaoMock.checkAvailability.mockRejectedValue(new Error('DB down'));

        await request(app).get(`${availabilityUrl}?partySize=2`).set('x-test-role', 'hiker').expect(500);
    });
});

describe('POST /api/slots/:slotId/reservations - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).post(bookingUrl).send({ people: 2 }).expect(401);

        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
    });

    it.each(['employee', 'warden'])('responds 403 if logged in as %s', async (role) => {
        await request(app).post(bookingUrl).set('x-test-role', role).send({ people: 2 }).expect(403);

        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
    });
});

describe('POST /api/slots/:slotId/reservations - booking', () => {
    it('creates the reservation for the logged hiker and responds 201', async () => {
        setupSuccessfulBooking();

        const res = await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 3 }).expect(201);

        expect(res.body).toEqual({ ...reservation, confirmation_sent: true });
        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 3, null);
    });

    it('accepts people sent as a numeric string', async () => {
        setupSuccessfulBooking();

        await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: '3' }).expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 3, null);
    });

    it('responds 422 if the slot id is not a UUID', async () => {
        const res = await request(app).post('/api/slots/abc/reservations').set('x-test-role', 'hiker').send({ people: 2 }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['slotId']);
        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
    });

    it.each([
        ['missing', {}],
        ['0', { people: 0 }],
        ['negative', { people: -1 }],
        ['not an integer', { people: 2.5 }],
        ['not a number', { people: 'abc' }],
        ['null', { people: null }],
    ])('responds 422 if people is %s', async (_, body) => {
        const res = await request(app).post(bookingUrl).set('x-test-role', 'hiker').send(body).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['people']);
        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
    });

    it.each([
        [404, 'Slot not found'],
        [409, 'You already have a reservation for this time slot'],
        [409, 'The slot is being booked by other hikers, please try again'],
        [400, 'Insufficient seats available for this party size'],
        [400, 'Reservations must be made at least 2 hours before the slot starts'],
        [400, 'No tables are assigned to this slot yet.'],
    ])('responds %i when the DAO throws "%s"', async (status, message) => {
        reservationDaoMock.saveReservation.mockRejectedValue(new Error(message));

        const res = await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 2 }).expect(status);

        expect(res.body).toEqual({ error: message });
    });

    it('responds 500 on unexpected errors', async () => {
        reservationDaoMock.saveReservation.mockRejectedValue(new Error('DB down'));

        await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 2 }).expect(500);
    });
});

describe('POST /api/slots/:slotId/reservations - party requirements (MH-03)', () => {
    it('passes the requirements trimmed to the DAO', async () => {
        setupSuccessfulBooking();

        await request(app).post(bookingUrl).set('x-test-role', 'hiker')
            .send({ people: 2, requirements: '  Nut allergy  ' })
            .expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 2, 'Nut allergy');
    });

    it.each([
        ['null', null],
        ['an empty text', ''],
        ['only spaces', '   '],
    ])('passes null when the requirements are %s', async (_, requirements) => {
        setupSuccessfulBooking();

        await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 2, requirements }).expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 2, null);
    });

    it('accepts 500 characters (spaces around are not counted)', async () => {
        setupSuccessfulBooking();
        const text = 'x'.repeat(500);

        await request(app).post(bookingUrl).set('x-test-role', 'hiker')
            .send({ people: 2, requirements: `  ${text}  ` })
            .expect(201);

        expect(reservationDaoMock.saveReservation).toHaveBeenCalledWith(USER_ID, SLOT_ID, 2, text);
    });

    it.each([
        ['longer than 500 characters', 'x'.repeat(501)],
        ['a number', 42],
        ['a boolean', true],
        ['an array', ['nuts']],
        ['an object', { allergy: 'nuts' }],
    ])('responds 422 if the requirements are %s', async (_, requirements) => {
        const res = await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 2, requirements }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        expect(reservationDaoMock.saveReservation).not.toHaveBeenCalled();
    });
});

describe('POST /api/slots/:slotId/reservations - confirmation email (MH-03)', () => {
    it('sends the confirmation with the details of the new reservation', async () => {
        setupSuccessfulBooking();

        await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 3 }).expect(201);

        expect(reservationDaoMock.getReservationDetails).toHaveBeenCalledWith(RESERVATION_ID);
        expect(confirmationMock.sendReservationConfirmation).toHaveBeenCalledTimes(1);
        expect(confirmationMock.sendReservationConfirmation).toHaveBeenCalledWith(details(), 'created');
    });

    it('still responds 201 with confirmation_sent: false if the email cannot be sent', async () => {
        setupSuccessfulBooking();
        confirmationMock.sendReservationConfirmation.mockRejectedValue(new Error('SMTP down'));

        const res = await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 3 }).expect(201);

        expect(res.body).toEqual({ ...reservation, confirmation_sent: false });
    });

    it('still responds 201 with confirmation_sent: false if the details cannot be read', async () => {
        setupSuccessfulBooking();
        reservationDaoMock.getReservationDetails.mockRejectedValue(new Error('DB down'));

        const res = await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 3 }).expect(201);

        expect(res.body.confirmation_sent).toBe(false);
        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('sends no email when the booking fails', async () => {
        reservationDaoMock.saveReservation.mockRejectedValue(new Error('Insufficient seats available for this party size'));

        await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 3 }).expect(400);

        expect(reservationDaoMock.getReservationDetails).not.toHaveBeenCalled();
        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('sends no email when the input is not valid', async () => {
        await request(app).post(bookingUrl).set('x-test-role', 'hiker').send({ people: 0 }).expect(422);

        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });
});

describe('GET /api/reservations/:reservationId', () => {
    it('returns the details to the hiker who made the reservation', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(details());

        const res = await request(app).get(detailsUrl).set('x-test-role', 'hiker').expect(200);

        expect(res.body).toEqual(details());
        expect(reservationDaoMock.getReservationDetails).toHaveBeenCalledWith(RESERVATION_ID);
    });

    it('responds 404 if the reservation belongs to another hiker', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(details(OTHER_USER_ID));

        const res = await request(app).get(detailsUrl).set('x-test-role', 'hiker').expect(404);

        expect(res.body).toEqual({ error: 'Reservation not found' });
    });

    it('responds 404 if the reservation does not exist', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(null);

        const res = await request(app).get(detailsUrl).set('x-test-role', 'hiker').expect(404);

        expect(res.body).toEqual({ error: 'Reservation not found' });
    });

    it('responds 422 if the id is not a UUID', async () => {
        const res = await request(app).get('/api/reservations/abc').set('x-test-role', 'hiker').expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['reservationId']);
        expect(reservationDaoMock.getReservationDetails).not.toHaveBeenCalled();
    });

    it('responds 401 if not logged in', async () => {
        await request(app).get(detailsUrl).expect(401);
    });

    it.each(['employee', 'warden'])('responds 403 if logged in as %s', async (role) => {
        await request(app).get(detailsUrl).set('x-test-role', role).expect(403);

        expect(reservationDaoMock.getReservationDetails).not.toHaveBeenCalled();
    });

    it('responds 500 on unexpected errors', async () => {
        reservationDaoMock.getReservationDetails.mockRejectedValue(new Error('DB down'));

        await request(app).get(detailsUrl).set('x-test-role', 'hiker').expect(500);
    });
});

describe('POST /api/reservations/:reservationId/confirmation', () => {
    it('sends the confirmation again and responds 200', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(details());
        confirmationMock.sendReservationConfirmation.mockResolvedValue({ messageId: 'id' });

        const res = await request(app).post(resendUrl).set('x-test-role', 'hiker').expect(200);

        expect(res.body).toEqual({ message: 'Confirmation email sent to anna@example.com' });
        expect(confirmationMock.sendReservationConfirmation).toHaveBeenCalledWith(details());
    });

    it('responds 500 if the email cannot be sent', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(details());
        confirmationMock.sendReservationConfirmation.mockRejectedValue(new Error('SMTP down'));

        const res = await request(app).post(resendUrl).set('x-test-role', 'hiker').expect(500);

        expect(res.body).toEqual({ error: 'Failed to send the confirmation email' });
    });

    it('responds 404 and sends nothing if the reservation belongs to another hiker', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(details(OTHER_USER_ID));

        await request(app).post(resendUrl).set('x-test-role', 'hiker').expect(404);

        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('responds 404 if the reservation does not exist', async () => {
        reservationDaoMock.getReservationDetails.mockResolvedValue(null);

        await request(app).post(resendUrl).set('x-test-role', 'hiker').expect(404);

        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('responds 422 if the id is not a UUID', async () => {
        const res = await request(app).post('/api/reservations/abc/confirmation').set('x-test-role', 'hiker').expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['reservationId']);
    });

    it('responds 401 if not logged in', async () => {
        await request(app).post(resendUrl).expect(401);
    });

    it.each(['employee', 'warden'])('responds 403 if logged in as %s', async (role) => {
        await request(app).post(resendUrl).set('x-test-role', role).expect(403);

        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('responds 500 if the details cannot be read', async () => {
        reservationDaoMock.getReservationDetails.mockRejectedValue(new Error('DB down'));

        await request(app).post(resendUrl).set('x-test-role', 'hiker').expect(500);

        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });
});