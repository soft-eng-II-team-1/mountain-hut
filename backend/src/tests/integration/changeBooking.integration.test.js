// MH-06 - Change a booking: integration tests of PUT /api/reservations/:reservationId.
// Everything is real (routes, DAO, database) except the SMTP server: the emails end up in sendMail.mock.calls
import { jest } from '@jest/globals';
import crypto from 'node:crypto';

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
const DAY = 24 * HOUR;
const stamp = Date.now();
const PASSWORD = 'password123';

// All the test data has unique names/ids, so it does not clash with the seed and is removed at the end
const users = {};
const tableIds = {};
const slotIds = {};

const createUser = async (key, role) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex'); // same as UserDAO
    users[key] = await prisma.user.create({
        data: {
            user_id: crypto.randomUUID(), role, name: 'Test', surname: key,
            email: `${key}.${stamp}@test.it`.toLowerCase(), hash, salt,
        },
    });
};

const createTable = async (key, seats) => {
    const table = await prisma.table.create({
        data: { table_id: crypto.randomUUID(), number: `MH06-${stamp}-${key}`, seats },
    });
    tableIds[key] = table.table_id;
};

const createSlot = async (key, startsIn, tableKeys) => {
    const start = new Date(Date.now() + startsIn);
    const slot = await prisma.slot.create({
        data: { slot_id: crypto.randomUUID(), date_time_start: start, date_time_end: new Date(start.getTime() + HOUR) },
    });
    for (const tableKey of tableKeys) {
        await prisma.slot_table.create({
            data: { id: crypto.randomUUID(), slot_id: slot.slot_id, table_id: tableIds[tableKey] },
        });
    }
    slotIds[key] = slot.slot_id;
};

// Returns an agent that keeps the session cookie of the given user
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

// Books through the API (MH-01) and returns the id of the reservation
const book = async (agent, slotKey, people, requirements = null) => {
    const res = await agent.post(`/api/slots/${slotIds[slotKey]}/reservations`).send({ people, requirements }).expect(201);
    return res.body.reservation_id;
};

const change = (agent, reservationId, slotKey, people, requirements = null) =>
    agent.put(`/api/reservations/${reservationId}`).send({ slot_id: slotIds[slotKey], people, requirements });

// Seats of a reservation in the DB, per table key (e.g. { A: 3 })
const seatsOf = async (reservationId) => {
    const rows = await prisma.reservation_table.findMany({ where: { reservation_id: reservationId } });
    return Object.fromEntries(rows.map((r) => [
        Object.keys(tableIds).find((key) => tableIds[key] === r.table_id),
        r.seats_reserved,
    ]));
};

const saved = (reservationId) => prisma.reservation.findUnique({ where: { reservation_id: reservationId } });

const removeTestReservations = async () => {
    const ids = Object.values(slotIds);
    await prisma.reservation_table.deleteMany({ where: { reservation: { slot_id: { in: ids } } } });
    await prisma.reservation.deleteMany({ where: { slot_id: { in: ids } } });
};

let anna;
let bruno;

beforeAll(async () => {
    for (const key of ['anna', 'bruno', 'carla']) {
        await createUser(key, 'hiker');
    }
    await createUser('employee', 'employee');

    await createTable('A', 4);
    await createTable('B', 2);
    await createTable('C', 6);
    await createTable('D', 4);
    await createTable('E', 4);

    await createSlot('main', 5 * DAY, ['A', 'B', 'C']); // 12 seats
    await createSlot('other', 6 * DAY, ['D']);
    await createSlot('tomorrow', DAY, ['E']);            // less than 48 hours: cannot be changed

    anna = await loginAs('anna');
    bruno = await loginAs('bruno');
});

// Every test starts with empty slots and no emails
beforeEach(async () => {
    await removeTestReservations();
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: 'test-message-id' });
});

afterAll(async () => {
    await removeTestReservations();
    const ids = Object.values(slotIds);
    await prisma.slot_table.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.slot.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.table.deleteMany({ where: { table_id: { in: Object.values(tableIds) } } });
    await prisma.user.deleteMany({ where: { user_id: { in: Object.values(users).map((u) => u.user_id) } } });
    await prisma.$disconnect();
});

describe('PUT /api/reservations/:reservationId', () => {
    it('can be used only by the hiker who made the reservation', async () => {
        const id = await book(anna, 'main', 3);
        const employee = await loginAs('employee');

        await change(request(app), id, 'main', 2).expect(401);
        await change(employee, id, 'main', 2).expect(403);
        await change(bruno, id, 'main', 2).expect(404);

        expect((await saved(id)).people).toBe(3);
    });

    it('responds 422 for invalid data', async () => {
        const id = await book(anna, 'main', 3);

        const res = await anna.put(`/api/reservations/${id}`).send({ slot_id: 'abc', people: 0 }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['slot_id', 'people', 'requirements']);
    });

    it('changes the requirements, keeps the booking reference and the tables and emails the hiker', async () => {
        const id = await book(anna, 'main', 3);
        sendMail.mockClear();

        const res = await change(anna, id, 'main', 3, 'One vegetarian').expect(200);

        expect(res.body).toMatchObject({ reservation_id: id, requirements: 'One vegetarian', changed: true, confirmation_sent: true });
        expect(await seatsOf(id)).toEqual({ A: 3 });
        expect(sendMail).toHaveBeenCalledTimes(1);
        const [{ to, subject, text }] = sendMail.mock.calls[0];
        expect(to).toBe(users.anna.email);
        expect(subject).toBe('Mountain Hut - Booking updated');
        expect(text).toContain('One vegetarian');
    });

    it('sends no email when nothing changes', async () => {
        const id = await book(anna, 'main', 3, 'Vegan');
        sendMail.mockClear();

        const res = await change(anna, id, 'main', 3, 'Vegan').expect(200);

        expect(res.body.changed).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('releases the table that is no longer needed when the party gets smaller', async () => {
        // 8 people: C 6 + B 2 -> 6 people: only C
        const id = await book(anna, 'main', 8);

        await change(anna, id, 'main', 6).expect(200);

        expect(await seatsOf(id)).toEqual({ C: 6 });
    });

    it('keeps the table when the bigger party still fits at it', async () => {
        const id = await book(anna, 'main', 3);

        await change(anna, id, 'main', 4).expect(200);

        expect(await seatsOf(id)).toEqual({ A: 4 });
    });

    it('assigns the tables again when the bigger party no longer fits at its tables', async () => {
        // bruno has C. anna: 3 at A -> 5: her seats are released and she gets A 4 + B 1
        await book(bruno, 'main', 6);
        const id = await book(anna, 'main', 3);

        await change(anna, id, 'main', 5).expect(200);

        expect(await seatsOf(id)).toEqual({ A: 4, B: 1 });
    });

    it('refuses a bigger party when there are not enough seats and keeps the booking as it was', async () => {
        // Only 1 free seat left in the slot
        await book(bruno, 'main', 6);
        const carla = await loginAs('carla');
        await book(carla, 'main', 2);
        const id = await book(anna, 'main', 3);
        sendMail.mockClear();

        const res = await change(anna, id, 'main', 5).expect(400);

        expect(res.body.error).toBe('Insufficient seats available for this party size');
        expect((await saved(id)).people).toBe(3);
        expect(await seatsOf(id)).toEqual({ A: 3 });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('moves the reservation to another slot and frees the seats of the old one', async () => {
        const id = await book(anna, 'main', 3);

        const res = await change(anna, id, 'other', 3).expect(200);

        expect(res.body).toMatchObject({ reservation_id: id, slot: { slot_id: slotIds.other } });
        expect(await seatsOf(id)).toEqual({ D: 3 });
        await book(bruno, 'main', 12); // the whole old slot is free again
    });

    it('responds 409 if the hiker already has a reservation in the new slot', async () => {
        const id = await book(anna, 'main', 3);
        await book(anna, 'other', 2);

        await change(anna, id, 'other', 3).expect(409);

        expect((await saved(id)).slot_id).toBe(slotIds.main);
    });

    it('responds 400 when the slot starts in less than 48 hours', async () => {
        const id = await book(anna, 'tomorrow', 2);

        const res = await change(anna, id, 'tomorrow', 1).expect(400);

        expect(res.body.error).toBe('Reservation can be changed only up to 48h before the slot starts');
        expect((await saved(id)).people).toBe(2);
    });

    it('does not overbook when two hikers make their party bigger at the same time', async () => {
        // "other" has one table of 4 seats: 1 + 1 taken, both parties try to become 3
        const idAnna = await book(anna, 'other', 1);
        const idBruno = await book(bruno, 'other', 1);

        const results = await Promise.all([change(anna, idAnna, 'other', 3), change(bruno, idBruno, 'other', 3)]);

        // Only one change is accepted, the other one is refused (no seats or concurrent update)
        const statuses = results.map((r) => r.status).sort();
        expect(statuses[0]).toBe(200);
        expect([400, 409]).toContain(statuses[1]);
        const rows = await prisma.reservation_table.findMany({ where: { reservation: { slot_id: slotIds.other } } });
        expect(rows.reduce((sum, r) => sum + r.seats_reserved, 0)).toBe(4);
    });
});
