import { jest } from '@jest/globals';
import crypto from 'node:crypto';

// The SMTP server is replaced (as in confirmation.integration.test.js): without this mock every
// booking would send a real email and wait for the SMTP server, making the tests slow and flaky
const nodemailerMock = {
    createTransport: jest.fn(() => ({ sendMail: jest.fn(async () => ({ messageId: 'test-message-id' })) })),
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

// All the test data has unique names/ids, so it does not clash with the seed and is removed at the end
const users = {};
const tableIds = {};
const slotIds = {};

const createUser = async (key, role) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex'); // same as UserDAO
    const user = await prisma.user.create({
        data: {
            user_id: crypto.randomUUID(),
            role,
            name: 'Test',
            surname: key,
            email: `${key}.${stamp}@test.it`.toLowerCase(),
            hash,
            salt,
        },
    });
    users[key] = user;
};

const createTable = async (key, seats) => {
    const table = await prisma.table.create({
        data: { table_id: crypto.randomUUID(), number: `IT-${stamp}-${key}`, seats },
    });
    tableIds[key] = table.table_id;
};

const createSlot = async (key, startsIn, tableKeys) => {
    const start = new Date(Date.now() + startsIn);
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
};

// Returns an agent that keeps the session cookie of the given user
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

const book = (agent, slotKeyOrId, body) => {
    const slotId = slotIds[slotKeyOrId] ?? slotKeyOrId;
    return agent.post(`/api/slots/${slotId}/reservations`).send(body);
};

// Seats reserved in the DB for a slot, per table key
const reservedSeats = async (slotKey) => {
    const rows = await prisma.reservation_table.findMany({
        where: { reservation: { slot_id: slotIds[slotKey] } },
    });
    const byTable = {};
    for (const [key, id] of Object.entries(tableIds)) {
        byTable[key] = rows.filter((r) => r.table_id === id).reduce((s, r) => s + r.seats_reserved, 0);
    }
    return byTable;
};

beforeAll(async () => {
    for (const key of ['hiker1', 'hiker2', 'hiker3', 'hiker4', 'hiker5', 'hikerA', 'hikerB']) {
        await createUser(key, 'hiker');
    }
    await createUser('employee', 'employee');

    await createTable('A', 4);
    await createTable('B', 2);
    await createTable('C', 6);
    await createTable('D', 2);
    await createTable('E', 4);

    await createSlot('main', 5 * 24 * HOUR, ['A', 'B', 'C']);     // 12 seats, used by most tests
    await createSlot('soon', 1 * HOUR, ['E']);                    // starts in less than 2 hours
    await createSlot('justInTime', 2 * HOUR + 5 * 60 * 1000, ['E']); // starts in 2h05m
    await createSlot('noTables', 6 * 24 * HOUR, []);
    await createSlot('race', 7 * 24 * HOUR, ['D']);               // 2 seats, for the concurrency test
});

afterAll(async () => {
    const slots = Object.values(slotIds);
    await prisma.reservation_table.deleteMany({ where: { reservation: { slot_id: { in: slots } } } });
    await prisma.reservation.deleteMany({ where: { slot_id: { in: slots } } });
    await prisma.slot_table.deleteMany({ where: { slot_id: { in: slots } } });
    await prisma.slot.deleteMany({ where: { slot_id: { in: slots } } });
    await prisma.table.deleteMany({ where: { table_id: { in: Object.values(tableIds) } } });
    await prisma.user.deleteMany({ where: { user_id: { in: Object.values(users).map((u) => u.user_id) } } });
    await prisma.$disconnect();
});

describe('GET /api/slots/:slotId/availability', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).get(`/api/slots/${slotIds.main}/availability?partySize=2`).expect(401);
    });

    it('returns the free seats of the slot', async () => {
        const agent = await loginAs('hiker5');

        const res = await agent.get(`/api/slots/${slotIds.main}/availability?partySize=2`).expect(200);

        expect(res.body.available).toBe(true);
        expect(res.body.totalAvailableSeats).toBe(12);
        expect(res.body.availableTables).toHaveLength(3);
    });

    it('responds 400 if the party is bigger than the free seats', async () => {
        const agent = await loginAs('hiker5');
        await agent.get(`/api/slots/${slotIds.main}/availability?partySize=13`).expect(400);
    });

    it('responds 422 if partySize is missing or not a positive integer', async () => {
        const agent = await loginAs('hiker5');
        for (const query of ['', '?partySize=0', '?partySize=-1', '?partySize=1.5', '?partySize=abc']) {
            const res = await agent.get(`/api/slots/${slotIds.main}/availability${query}`).expect(422);
            expect(res.body.errors.map((e) => e.field)).toContain('partySize');
        }
    });

    it('responds 422 if the slot id is not a valid UUID', async () => {
        const agent = await loginAs('hiker5');

        const res = await agent.get('/api/slots/not-a-uuid/availability?partySize=2').expect(422);

        expect(res.body.errors.map((e) => e.field)).toContain('slotId');
    });

    it('responds 404 if the slot has no tables', async () => {
        const agent = await loginAs('hiker5');
        await agent.get(`/api/slots/${slotIds.noTables}/availability?partySize=2`).expect(404);
    });
});

describe('POST /api/slots/:slotId/reservations - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await book(request(app), 'main', { people: 2 }).expect(401);
    });

    it('responds 403 if logged in as employee', async () => {
        const agent = await loginAs('employee');
        await book(agent, 'main', { people: 2 }).expect(403);
    });
});

describe('POST /api/slots/:slotId/reservations - input validation', () => {
     it('responds 422 if people is missing', async () => {
        const agent = await loginAs('hiker5');

        const res = await book(agent, 'main', {}).expect(422);

        expect(res.body.errors.map((e) => e.field)).toContain('people');
    });

    it.each([0, -1, 2.5, 'abc', null])('responds 422 if people is %p', async (people) => {
        const agent = await loginAs('hiker5');
        await book(agent, 'main', { people }).expect(422);
    });

    it('responds 422 if the slot id is not a valid UUID', async () => {
        const agent = await loginAs('hiker5');

        const res = await book(agent, 'not-a-uuid', { people: 2 }).expect(422);

        expect(res.body.errors.map((e) => e.field)).toContain('slotId');
    });

    it('responds 404 if the slot does not exist', async () => {
        const agent = await loginAs('hiker5');
        await book(agent, crypto.randomUUID(), { people: 2 }).expect(404);
    });

    it('does not save anything after invalid requests', async () => {
        const count = await prisma.reservation.count({ where: { user_id: users.hiker5.user_id } });
        expect(count).toBe(0);
    });
});

describe('POST /api/slots/:slotId/reservations - constraints', () => {
    it('responds 400 if the slot starts in less than 2 hours', async () => {
        const agent = await loginAs('hiker5');

        const res = await book(agent, 'soon', { people: 2 }).expect(400);

        expect(res.body.error).toBe('Reservations must be made at least 2 hours before the slot starts');
    });

    it('accepts a booking a few minutes more than 2 hours before the slot', async () => {
        const agent = await loginAs('hiker5');
        await book(agent, 'justInTime', { people: 2 }).expect(201);
    });

    it('responds 400 if the slot has no tables', async () => {
        const agent = await loginAs('hiker5');
        await book(agent, 'noTables', { people: 2 }).expect(400);
    });

    it('responds 400 if the party is bigger than all the seats of the slot', async () => {
        const agent = await loginAs('hiker5');

        const res = await book(agent, 'main', { people: 13 }).expect(400);

        expect(res.body.error).toBe('Insufficient seats available for this party size');
    });
});

// These tests run in order and fill the "main" slot (A: 4, B: 2, C: 6 seats)
describe('POST /api/slots/:slotId/reservations - booking and table assignment', () => {
    it('seats the whole party at the smallest table that fits', async () => {
        const agent = await loginAs('hiker1');

        const res = await book(agent, 'main', { people: 3 }).expect(201);

        expect(res.body).toMatchObject({ people: 3, slot_id: slotIds.main, user_id: users.hiker1.user_id });
        expect(res.body.tables).toEqual([
            { table_id: tableIds.A, number: `IT-${stamp}-A`, seats_reserved: 3 },
        ]);

        const saved = await prisma.reservation.findUnique({
            where: { reservation_id: res.body.reservation_id },
            include: { reservation_table: true },
        });
        expect(saved.people).toBe(3);
        expect(saved.reservation_table).toHaveLength(1);
        expect(saved.reservation_table[0]).toMatchObject({ table_id: tableIds.A, seats_reserved: 3 });
    });

    it('responds 409 if the same hiker books the same slot again', async () => {
        const agent = await loginAs('hiker1');

        const res = await book(agent, 'main', { people: 1 }).expect(409);

        expect(res.body.error).toBe('You already have a reservation for this time slot');
        const count = await prisma.reservation.count({
            where: { user_id: users.hiker1.user_id, slot_id: slotIds.main },
        });
        expect(count).toBe(1);
    });

    it('shares a table with another party when it is the best fit', async () => {
        // Free seats now: A 1, B 2, C 6 -> a party of 1 goes to A, together with hiker1
        const agent = await loginAs('hiker2');

        const res = await book(agent, 'main', { people: 1 }).expect(201);

        expect(res.body.tables).toEqual([
            { table_id: tableIds.A, number: `IT-${stamp}-A`, seats_reserved: 1 },
        ]);
    });

    it('splits the party over the fewest tables when no table is big enough', async () => {
        // Free seats now: A 0, B 2, C 6 -> a party of 8 takes C (6) + B (2)
        const agent = await loginAs('hiker3');

        const res = await book(agent, 'main', { people: 8 }).expect(201);

        expect(res.body.tables).toEqual([
            { table_id: tableIds.C, number: `IT-${stamp}-C`, seats_reserved: 6 },
            { table_id: tableIds.B, number: `IT-${stamp}-B`, seats_reserved: 2 },
        ]);
    });

    it('responds 400 when the slot is full', async () => {
        const agent = await loginAs('hiker4');

        const res = await book(agent, 'main', { people: 1 }).expect(400);

        expect(res.body.error).toBe('Insufficient seats available for this party size');
    });

    it('never reserves more seats than a table has', async () => {
        const seats = await reservedSeats('main');

        expect(seats).toMatchObject({ A: 4, B: 2, C: 6 });
    });

    it('lets the same hiker book a different slot', async () => {
        const agent = await loginAs('hiker1');
        await book(agent, 'justInTime', { people: 1 }).expect(201);
    });
});

describe('POST /api/slots/:slotId/reservations - concurrency', () => {
    it('does not overbook when two hikers book the last seats at the same time', async () => {
        // The "race" slot has a single table with 2 seats: only one party of 2 can fit
        const agentA = await loginAs('hikerA');
        const agentB = await loginAs('hikerB');

        const [resA, resB] = await Promise.all([
            book(agentA, 'race', { people: 2 }),
            book(agentB, 'race', { people: 2 }),
        ]);

        const statuses = [resA.status, resB.status].sort();
        expect(statuses[0]).toBe(201);
        expect([400, 409]).toContain(statuses[1]);

        const seats = await reservedSeats('race');
        expect(seats.D).toBe(2);
    });
});