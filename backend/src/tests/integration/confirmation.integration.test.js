import { jest } from '@jest/globals';
import crypto from 'node:crypto';

// The SMTP server is the only part that is replaced: routes, DAO, confirmation service,
// mailer.js and the database are the real ones. Every email is captured in sendMail.mock.calls
const sendMail = jest.fn();
const nodemailerMock = {
    createTransport: jest.fn(() => ({ sendMail })),
    createTestAccount: jest.fn(async () => ({ user: 'test-user', pass: 'test-pass' })),
    getTestMessageUrl: jest.fn(() => false),
};
jest.unstable_mockModule('nodemailer', () => ({ default: nodemailerMock }));

// Must be imported AFTER the mock
const { default: request } = await import('supertest');
const { default: app } = await import('../../app.js');
const { prisma } = await import('../../../prisma.client.ts');

const HOUR = 60 * 60 * 1000;
const stamp = Date.now();
const PASSWORD = 'password123';

const users = {};
const tableIds = {};
const slotIds = {};
const slots = {};

const createUser = async (key, role, name, surname) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex'); // same as UserDAO
    users[key] = await prisma.user.create({
        data: {
            user_id: crypto.randomUUID(),
            role,
            name,
            surname,
            email: `${key}.${stamp}@test.it`.toLowerCase(),
            hash,
            salt,
        },
    });
};

const createTable = async (key, seats) => {
    const table = await prisma.table.create({
        data: { table_id: crypto.randomUUID(), number: `MH03-${stamp}-${key}`, seats },
    });
    tableIds[key] = table.table_id;
};

const createSlot = async (key, startsIn, tableKeys) => {
    const start = new Date(Date.now() + startsIn);
    start.setUTCSeconds(0, 0);
    const slot = await prisma.slot.create({
        data: {
            slot_id: crypto.randomUUID(),
            date_time_start: start,
            date_time_end: new Date(start.getTime() + HOUR),
        },
    });
    for (const tableKey of tableKeys) {
        await prisma.slot_table.create({
            data: { id: crypto.randomUUID(), slot_id: slot.slot_id, table_id: tableIds[tableKey] },
        });
    }
    slotIds[key] = slot.slot_id;
    slots[key] = slot;
};

// Returns an agent that keeps the session cookie of the given user
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

const book = (agent, slotKey, body) => agent.post(`/api/slots/${slotIds[slotKey]}/reservations`).send(body);

// Emails sent so far, as passed to nodemailer: { from, to, subject, text, html }
const sentEmails = () => sendMail.mock.calls.map(([message]) => message);
const lastEmail = () => sentEmails().at(-1);

beforeAll(async () => {
    await createUser('anna', 'hiker', 'Anna', 'Bianchi');
    await createUser('marco', 'hiker', 'Marco', 'Rossi');
    await createUser('luca', 'hiker', 'Luca', 'Verdi');
    await createUser('giulia', 'hiker', 'Giulia', 'Neri');
    await createUser('sofia', 'hiker', 'Sofia', 'Gialli');
    await createUser('paolo', 'hiker', 'Paolo', 'Blu');
    await createUser('elena', 'hiker', 'Elena', 'Viola');
    await createUser('employee', 'employee', 'Emma', 'Staff');

    await createTable('A', 6);
    await createTable('B', 4);
    await createTable('C', 2);

    await createSlot('lunch', 3 * 24 * HOUR, ['A', 'B']);
    await createSlot('dinner', 3 * 24 * HOUR + 8 * HOUR, ['A']);
    await createSlot('small', 4 * 24 * HOUR, ['C']);
    await createSlot('soon', HOUR, ['A']);
});

beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: 'test-message-id' });
});

afterAll(async () => {
    const ids = Object.values(slotIds);
    await prisma.reservation_table.deleteMany({ where: { reservation: { slot_id: { in: ids } } } });
    await prisma.reservation.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.slot_table.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.slot.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.table.deleteMany({ where: { table_id: { in: Object.values(tableIds) } } });
    await prisma.user.deleteMany({ where: { user_id: { in: Object.values(users).map((u) => u.user_id) } } });
    await prisma.$disconnect();
});

describe('Confirmation email after a booking', () => {
    it('sends one email to the hiker who made the reservation', async () => {
        const agent = await loginAs('anna');

        const res = await book(agent, 'lunch', { people: 3 }).expect(201);

        expect(res.body.confirmation_sent).toBe(true);
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(lastEmail().to).toBe(users.anna.email);
    });

    it('saves the party requirements and still sends one confirmation', async () => {
        const agent = await loginAs('marco');
        const requirements = 'One person is allergic to nuts';

        const res = await book(agent, 'lunch', { people: 2, requirements }).expect(201);

        const saved = await prisma.reservation.findUnique({ where: { reservation_id: res.body.reservation_id } });
        expect(saved).toMatchObject({ user_id: users.marco.user_id, people: 2, requirements });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(lastEmail().to).toBe(users.marco.email);
    });

    it('sends each confirmation only to the hiker who booked', async () => {
        const agentGiulia = await loginAs('giulia');
        const agentSofia = await loginAs('sofia');

        await book(agentGiulia, 'dinner', { people: 1 }).expect(201);
        await book(agentSofia, 'dinner', { people: 1 }).expect(201);

        expect(sentEmails().map((email) => email.to)).toEqual([users.giulia.email, users.sofia.email]);
    });
});

describe('Party requirements', () => {
    it('saves the requirements trimmed and returns them in the response', async () => {
        const agent = await loginAs('paolo');

        const res = await book(agent, 'small', { people: 1, requirements: '   Vegan menu   ' }).expect(201);

        const saved = await prisma.reservation.findUnique({ where: { reservation_id: res.body.reservation_id } });
        expect(saved.requirements).toBe('Vegan menu');
        expect(res.body.requirements).toBe('Vegan menu');
    });

    it.each([
        ['omitted', {}],
        ['null', { requirements: null }],
        ['an empty text', { requirements: '' }],
        ['only spaces', { requirements: '    ' }],
    ])('stores no requirements when they are %s', async (_, extra) => {
        const agent = await loginAs('elena');

        const res = await book(agent, 'small', { people: 1, ...extra }).expect(201);

        const saved = await prisma.reservation.findUnique({ where: { reservation_id: res.body.reservation_id } });
        expect(saved.requirements).toBeNull();
        expect(sendMail).toHaveBeenCalledTimes(1);

        // Same hiker in the next case: remove the booking ("only one booking per slot")
        await prisma.reservation_table.deleteMany({ where: { reservation_id: saved.reservation_id } });
        await prisma.reservation.delete({ where: { reservation_id: saved.reservation_id } });
    });

    it('accepts requirements of exactly 500 characters', async () => {
        const agent = await loginAs('elena');
        const requirements = 'x'.repeat(500);

        const res = await book(agent, 'small', { people: 1, requirements }).expect(201);

        const saved = await prisma.reservation.findUnique({ where: { reservation_id: res.body.reservation_id } });
        expect(saved.requirements).toBe(requirements);
        await prisma.reservation_table.deleteMany({ where: { reservation_id: saved.reservation_id } });
        await prisma.reservation.delete({ where: { reservation_id: saved.reservation_id } });
    });

    it.each([
        ['longer than 500 characters', 'x'.repeat(501)],
        ['a number', 42],
        ['an array', ['nuts']],
        ['an object', { allergy: 'nuts' }],
    ])('responds 422 and sends no email when requirements are %s', async (_, requirements) => {
        const agent = await loginAs('elena');

        const res = await book(agent, 'small', { people: 1, requirements }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toContain('requirements');
        expect(sendMail).not.toHaveBeenCalled();
        const count = await prisma.reservation.count({ where: { user_id: users.elena.user_id } });
        expect(count).toBe(0);
    });
});

describe('No confirmation when the booking fails', () => {
    it('sends no email for a second booking of the same hiker in the same slot (409)', async () => {
        const agent = await loginAs('anna');
        await book(agent, 'lunch', { people: 1 }).expect(409);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends no email when there are not enough seats (400)', async () => {
        const agent = await loginAs('anna');
        await book(agent, 'small', { people: 3 }).expect(400);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends no email when the slot starts in less than 2 hours (400)', async () => {
        const agent = await loginAs('anna');
        await book(agent, 'soon', { people: 1 }).expect(400);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends no email when the slot does not exist (404)', async () => {
        const agent = await loginAs('anna');
        await agent.post(`/api/slots/${crypto.randomUUID()}/reservations`).send({ people: 1 }).expect(404);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends no email for invalid input (422)', async () => {
        const agent = await loginAs('anna');
        await book(agent, 'dinner', { people: 0 }).expect(422);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends no email when the user is not a hiker (403) or not logged in (401)', async () => {
        const employee = await loginAs('employee');
        await book(employee, 'dinner', { people: 1 }).expect(403);
        await book(request(app), 'dinner', { people: 1 }).expect(401);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('Email server failure', () => {
    it('keeps the reservation and reports confirmation_sent: false if the email cannot be sent', async () => {
        sendMail.mockRejectedValue(new Error('SMTP server not reachable'));
        const agent = await loginAs('giulia');

        const res = await book(agent, 'lunch', { people: 2 }).expect(201);

        expect(res.body.confirmation_sent).toBe(false);
        const saved = await prisma.reservation.findUnique({ where: { reservation_id: res.body.reservation_id } });
        expect(saved).not.toBeNull();
        expect(saved.people).toBe(2);
    });
});

describe('GET /api/reservations/:reservationId', () => {
    let reservationId;

    beforeAll(async () => {
        const reservation = await prisma.reservation.findFirst({
            where: { user_id: users.marco.user_id, slot_id: slotIds.lunch },
        });
        reservationId = reservation.reservation_id;
    });

    it('returns the details of the confirmation to the hiker who booked', async () => {
        const agent = await loginAs('marco');

        const res = await agent.get(`/api/reservations/${reservationId}`).expect(200);

        expect(res.body).toMatchObject({
            reservation_id: reservationId,
            people: 2,
            requirements: 'One person is allergic to nuts',
            slot: {
                slot_id: slotIds.lunch,
                date_time_start: slots.lunch.date_time_start.toISOString(),
                date_time_end: slots.lunch.date_time_end.toISOString(),
            },
            hiker: { user_id: users.marco.user_id, name: 'Marco', surname: 'Rossi', email: users.marco.email },
        });
        expect(res.body.tables.reduce((sum, t) => sum + t.seats_reserved, 0)).toBe(2);
    });

    it('never exposes the password hash or salt of the hiker', async () => {
        const agent = await loginAs('marco');

        const res = await agent.get(`/api/reservations/${reservationId}`).expect(200);

        expect(res.body.hiker).not.toHaveProperty('hash');
        expect(res.body.hiker).not.toHaveProperty('salt');
    });

    it('responds 404 to another hiker, without revealing that the reservation exists', async () => {
        const agent = await loginAs('anna');

        const res = await agent.get(`/api/reservations/${reservationId}`).expect(404);

        expect(res.body).toEqual({ error: 'Reservation not found' });
    });

    it('responds 404 if the reservation does not exist', async () => {
        const agent = await loginAs('marco');
        await agent.get(`/api/reservations/${crypto.randomUUID()}`).expect(404);
    });

    it('responds 422 if the id is not a valid UUID', async () => {
        const agent = await loginAs('marco');

        const res = await agent.get('/api/reservations/not-a-uuid').expect(422);

        expect(res.body.errors.map((e) => e.field)).toContain('reservationId');
    });

    it('responds 401 if not logged in and 403 if not a hiker', async () => {
        await request(app).get(`/api/reservations/${reservationId}`).expect(401);
        const employee = await loginAs('employee');
        await employee.get(`/api/reservations/${reservationId}`).expect(403);
    });
});

describe('POST /api/reservations/:reservationId/confirmation (send again)', () => {
    let reservationId;

    beforeAll(async () => {
        const reservation = await prisma.reservation.findFirst({
            where: { user_id: users.marco.user_id, slot_id: slotIds.lunch },
        });
        reservationId = reservation.reservation_id;
    });

    it('sends the same confirmation again to the hiker who booked', async () => {
        const agent = await loginAs('marco');

        const res = await agent.post(`/api/reservations/${reservationId}/confirmation`).expect(200);

        expect(res.body.message).toContain(users.marco.email);
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(lastEmail().to).toBe(users.marco.email);
    });

    it('responds 500 if the email cannot be sent', async () => {
        sendMail.mockRejectedValue(new Error('SMTP server not reachable'));
        const agent = await loginAs('marco');

        const res = await agent.post(`/api/reservations/${reservationId}/confirmation`).expect(500);

        expect(res.body).toEqual({ error: 'Failed to send the confirmation email' });
    });

    it('responds 404 and sends nothing if the reservation belongs to another hiker', async () => {
        const agent = await loginAs('anna');

        await agent.post(`/api/reservations/${reservationId}/confirmation`).expect(404);

        expect(sendMail).not.toHaveBeenCalled();
    });

    it('responds 404 if the reservation does not exist', async () => {
        const agent = await loginAs('marco');
        await agent.post(`/api/reservations/${crypto.randomUUID()}/confirmation`).expect(404);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('responds 422 if the id is not a valid UUID', async () => {
        const agent = await loginAs('marco');
        await agent.post('/api/reservations/not-a-uuid/confirmation').expect(422);
    });

    it('responds 401 if not logged in and 403 if not a hiker', async () => {
        await request(app).post(`/api/reservations/${reservationId}/confirmation`).expect(401);
        const employee = await loginAs('employee');
        await employee.post(`/api/reservations/${reservationId}/confirmation`).expect(403);
        expect(sendMail).not.toHaveBeenCalled();
    });
});