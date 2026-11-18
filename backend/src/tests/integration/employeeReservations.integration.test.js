import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../../prisma.client.ts';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const stamp = Date.now();
const PASSWORD = 'password123';

const users = {};
const tableIds = {};
const slotIds = {};

//user in DB
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

//table in DB
const createTable = async (key, seats) => {
    const table = await prisma.table.create({
        data: { table_id: crypto.randomUUID(), number: `S-${stamp}-${key}`, seats },
    });
    tableIds[key] = table.table_id;
};

//slot in DB
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

//login
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

//book helper (employee for hiker)
const book = (agent, slotKeyOrId, body) => {
    const slotId = slotIds[slotKeyOrId] ?? slotKeyOrId;
    return agent.post(`/api/slots/${slotId}/reservations/for-hiker`).send(body);
};

//beforeall
beforeAll(async () => {
    await createUser('employee', 'employee');
    await createUser('hiker', 'hiker');

    await createTable('A', 4);
    await createTable('B', 6);

    await createSlot('main', 5 * 24 * HOUR, ['A', 'B']);         // future slot (5 days)
    await createSlot('soon', 30 * MINUTE, ['A']);                // starts in 30 min (< 2h)
    await createSlot('alreadyStarted', -10 * MINUTE, ['A']);     // started 10 min ago in the past
});

//afterall: clean
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

//EMPLOYEE RESERVATION FOR REGISTERED HIKER
describe('POST /api/slots/:slotId/reservations/for-hiker - employee booking for registered hiker', () => {
    it('employee books for an existing hiker using user_id, responds 201', async () => {
        const agent = await loginAs('employee');

        const res = await book(agent, 'main', {
            people: 2,
            user_id: users.hiker.user_id,
        }).expect(201);

        expect(res.body.reservation_id).toBeDefined();

        const saved = await prisma.reservation.findUnique({
            where: { reservation_id: res.body.reservation_id },
        });
        expect(saved.user_id).toBe(users.hiker.user_id);
        expect(saved.temporary_name).toBeNull();
    });
});

//EMPLOYEE RESERVATION FOR TEMPORARY HIKER (NO ACCOUNT / NO EMAIL)
describe('POST /api/slots/:slotId/reservations/for-hiker - employee booking for temporary hiker', () => {
    it('employee books for a temporary hiker with name and phone, responds 201', async () => {
        const agent = await loginAs('employee');

        const res = await book(agent, 'main', {
            people: 3,
            temporary_name: 'Paolo Bianchi',
            temporary_phone: '+39333444555',
        }).expect(201);

        const saved = await prisma.reservation.findUnique({
            where: { reservation_id: res.body.reservation_id },
        });
        expect(saved.user_id).toBeNull();
        expect(saved.temporary_name).toBe('Paolo Bianchi');
        expect(saved.temporary_phone).toBe('+39333444555');
    });

    it('employee books for a temporary hiker with name only (phone optional), responds 201', async () => {
        const agent = await loginAs('employee');

        const res = await book(agent, 'main', {
            people: 1,
            temporary_name: 'Giorgio SoloNome',
        }).expect(201);

        const saved = await prisma.reservation.findUnique({
            where: { reservation_id: res.body.reservation_id },
        });
        expect(saved.user_id).toBeNull();
        expect(saved.temporary_name).toBe('Giorgio SoloNome');
        expect(saved.temporary_phone).toBeNull();
    });
});

//TIME CONSTRAINTS: BYPASS 2H VS ALREADY STARTED
describe('POST /api/slots/:slotId/reservations/for-hiker - employee time constraints', () => {
    it('employee can book a slot starting in 30 minutes (bypasses 2h web cutoff)', async () => {
        const agent = await loginAs('employee');

        const res = await book(agent, 'soon', {
            people: 2,
            temporary_name: 'Quick Arrival',
        }).expect(201);

        expect(res.body.reservation_id).toBeDefined();
    });

    it('employee CANNOT book a slot that has already started, responds 400', async () => {
        const agent = await loginAs('employee');

        const res = await book(agent, 'alreadyStarted', {
            people: 2,
            temporary_name: 'Late Arrival',
        }).expect(400);

        expect(res.body.error).toBeDefined();
    });

    it('regular hiker CANNOT book a slot starting in 30 minutes, responds 400', async () => {
        const agent = await loginAs('hiker');

        await agent.post(`/api/slots/${slotIds.soon}/reservations`).send({ people: 2 }).expect(400);
    });
});

//VALIDATION TESTS
describe('POST /api/slots/:slotId/reservations/for-hiker - validation', () => {
    it('responds 422 if employee provides neither user_id nor temporary_name', async () => {
        const agent = await loginAs('employee');

        await book(agent, 'main', { people: 2 }).expect(422);
    });

    it('responds 422 if people is missing or non-positive', async () => {
        const agent = await loginAs('employee');

        await book(agent, 'main', { temporary_name: 'Test' }).expect(422);
        await book(agent, 'main', { people: 0, temporary_name: 'Test' }).expect(422);
        await book(agent, 'main', { people: -1, temporary_name: 'Test' }).expect(422);
    });
});

//AUTHORIZATION TESTS
describe('POST /api/slots/:slotId/reservations/for-hiker - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await book(request(app), 'main', { people: 2, temporary_name: 'No Auth' }).expect(401);
    });

    it('responds 403 if logged in as hiker', async () => {
        const agent = await loginAs('hiker');

        await book(agent, 'main', { people: 2, temporary_name: 'Hiker Forbidden' }).expect(403);
    });
});
