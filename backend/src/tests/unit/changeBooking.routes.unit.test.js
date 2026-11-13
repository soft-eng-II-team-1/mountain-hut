// MH-06 - Change a booking: unit tests of PUT /api/reservations/:reservationId
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const reservationDaoMock = {
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
const url = `/api/reservations/${RESERVATION_ID}`;

const details = { reservation_id: RESERVATION_ID, people: 4, requirements: 'One vegetarian' };

const put = (body, role = 'hiker') => request(app).put(url).set('x-test-role', role).send(body);

let consoleErrorSpy;

beforeEach(() => {
    jest.resetAllMocks();
    reservationDaoMock.updateReservation.mockResolvedValue({ changed: true });
    reservationDaoMock.getReservationDetails.mockResolvedValue(details);
    confirmationMock.sendReservationConfirmation.mockResolvedValue({ messageId: 'id' });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('PUT /api/reservations/:reservationId', () => {
    it('responds 401 if not logged in and 403 if not a hiker', async () => {
        await request(app).put(url).send({ slot_id: SLOT_ID, people: 4, requirements: null }).expect(401);
        await put({ slot_id: SLOT_ID, people: 4, requirements: null }, 'employee').expect(403);

        expect(reservationDaoMock.updateReservation).not.toHaveBeenCalled();
    });

    it('changes the reservation of the logged hiker and sends the "modified" email', async () => {
        const res = await put({ slot_id: SLOT_ID.toUpperCase(), people: '4', requirements: '  One vegetarian  ' }).expect(200);

        expect(reservationDaoMock.updateReservation).toHaveBeenCalledWith(
            RESERVATION_ID, USER_ID, { slotId: SLOT_ID, people: 4, requirements: 'One vegetarian' },
        );
        expect(confirmationMock.sendReservationConfirmation).toHaveBeenCalledWith(details, 'modified');
        expect(res.body).toEqual({ ...details, changed: true, confirmation_sent: true });
    });

    it('sends no email when nothing changed', async () => {
        reservationDaoMock.updateReservation.mockResolvedValue({ changed: false });

        const res = await put({ slot_id: SLOT_ID, people: 4, requirements: null }).expect(200);

        expect(res.body).toMatchObject({ changed: false, confirmation_sent: false });
        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('saves empty requirements as null', async () => {
        await put({ slot_id: SLOT_ID, people: 4, requirements: '   ' }).expect(200);

        expect(reservationDaoMock.updateReservation).toHaveBeenCalledWith(
            RESERVATION_ID, USER_ID, expect.objectContaining({ requirements: null }),
        );
    });

    it('still responds 200 with confirmation_sent: false if the email cannot be sent', async () => {
        confirmationMock.sendReservationConfirmation.mockRejectedValue(new Error('SMTP down'));

        const res = await put({ slot_id: SLOT_ID, people: 4, requirements: null }).expect(200);

        expect(res.body.confirmation_sent).toBe(false);
    });

    it('responds 422 with all the invalid fields', async () => {
        const res = await request(app).put('/api/reservations/abc').set('x-test-role', 'hiker')
            .send({ slot_id: 42, people: 0, requirements: 'x'.repeat(501) })
            .expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['reservationId', 'slot_id', 'people', 'requirements']);
        expect(reservationDaoMock.updateReservation).not.toHaveBeenCalled();
    });

    it('responds 422 if the requirements are missing (the whole new state is required)', async () => {
        const res = await put({ slot_id: SLOT_ID, people: 4 }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
    });

    it.each([
        ['NOT_FOUND', 404],
        ['TOO_LATE', 400],
        ['ALREADY_BOOKED', 409],
        ['UNKNOWN_CODE', 500],
    ])('maps the DAO error %s to status %i and sends no email', async (code, status) => {
        reservationDaoMock.updateReservation.mockRejectedValue(new ReservationError(code, 'message'));

        const res = await put({ slot_id: SLOT_ID, people: 4, requirements: null }).expect(status);

        expect(res.body).toEqual({ error: 'message' });
        expect(confirmationMock.sendReservationConfirmation).not.toHaveBeenCalled();
    });

    it('responds 400 if the new slot has no tables and 500 on unexpected errors', async () => {
        reservationDaoMock.updateReservation.mockRejectedValueOnce(new Error('No tables are assigned to this slot yet.'));
        await put({ slot_id: SLOT_ID, people: 4, requirements: null }).expect(400);

        reservationDaoMock.updateReservation.mockRejectedValueOnce(new Error('DB down'));
        await put({ slot_id: SLOT_ID, people: 4, requirements: null }).expect(500);
    });
});
