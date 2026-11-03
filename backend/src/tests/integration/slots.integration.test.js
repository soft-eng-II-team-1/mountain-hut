import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../app.js';
import UserDAO from '../../dao/UserDAO.js';
import { prisma } from '../../../prisma.client.ts';

const DAY = 24 * 60 * 60 * 1000;
const stamp = Date.now();

const employee = { email: `employee.slots.${stamp}@test.it`, password: 'employee123' };
const warden = { email: `warden.slots.${stamp}@test.it`, password: 'warden123' };
const hiker = { email: `hiker.slots.${stamp}@test.it`, password: 'password123' };

// Slots cannot overlap with any other slot in the DB (seed included), so the test slots are on a
// day far in the future, different for each run. Everything in [BASE, BASE + 10 days) is removed at the end
const BASE = Date.UTC(2090, 0, 1) + (stamp % 10000) * DAY;
const at = (day, hour, minute = 0) => new Date(BASE + day * DAY + (hour * 60 + minute) * 60 * 1000).toISOString();

const tableIds = {};

const createTable = async (key, seats) => {
    const table = await prisma.table.create({
        data: { table_id: crypto.randomUUID(), number: `S-${stamp}-${key}`, seats },
    });
    tableIds[key] = table.table_id;
};

// Helper: returns an agent that keeps the session cookie of the given user
const loginAs = async (credentials) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);
    return agent;
};

// Helper: body of POST/PUT /api/slots
const slotBody = (start, end, tableKeys) => ({
    date_time_start: start,
    date_time_end: end,
    table_ids: tableKeys.map((key) => tableIds[key]),
});

// Helper: table ids linked to a slot in the DB
const linkedTables = async (slotId) => {
    const rows = await prisma.slot_table.findMany({ where: { slot_id: slotId } });
    return rows.map((r) => r.table_id).sort();
};

beforeAll(async () => {
    const userDao = new UserDAO();
    await userDao.createUser({ name: 'Test', surname: 'Employee', ...employee, role: 'employee' });
    await userDao.createUser({ name: 'Test', surname: 'Warden', ...warden, role: 'warden' });
    await userDao.createUser({ name: 'Test', surname: 'Hiker', ...hiker });

    await createTable('A', 4);
    await createTable('B', 2);
    await createTable('C', 6);
    await createTable('D', 8);
});

afterAll(async () => {
    const testSlots = { date_time_start: { gte: new Date(BASE), lt: new Date(BASE + 10 * DAY) } };
    await prisma.reservation_table.deleteMany({ where: { reservation: { slot: testSlots } } });
    await prisma.reservation.deleteMany({ where: { slot: testSlots } });
    await prisma.slot_table.deleteMany({ where: { slot: testSlots } });
    await prisma.slot.deleteMany({ where: testSlots });
    await prisma.table.deleteMany({ where: { table_id: { in: Object.values(tableIds) } } });
    await prisma.user.deleteMany({ where: { email: { in: [employee.email, warden.email, hiker.email] } } });
    await prisma.$disconnect();
});

describe('Slot management - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).get('/api/slots').expect(401);
        await request(app).post('/api/slots').send(slotBody(at(0, 8), at(0, 9), ['A'])).expect(401);
    });

    it('responds 403 if logged in as hiker', async () => {
        const agent = await loginAs(hiker);

        await agent.get('/api/slots').expect(403);
        await agent.post('/api/slots').send(slotBody(at(0, 8), at(0, 9), ['A'])).expect(403);
    });

    it('lets the warden create a slot', async () => {
        const agent = await loginAs(warden);

        await agent.post('/api/slots').send(slotBody(at(9, 8), at(9, 9), ['A'])).expect(201);
    });
});

describe('POST /api/slots', () => {
    it('creates a slot with its tables and returns the total seats', async () => {
        const agent = await loginAs(employee);

        const res = await agent.post('/api/slots').send(slotBody(at(0, 12), at(0, 13), ['A', 'B'])).expect(201);

        expect(res.body).toMatchObject({
            date_time_start: at(0, 12),
            date_time_end: at(0, 13),
            total_seats: 6,
        });
        expect(res.body.tables.map((t) => t.table_id).sort()).toEqual([tableIds.A, tableIds.B].sort());
        expect(await linkedTables(res.body.slot_id)).toEqual([tableIds.A, tableIds.B].sort());
    });

    it('accepts a second slot of the same meal service right after the first one', async () => {
        // 12:00-13:00 already exists, 13:00-14:00 is adjacent
        const agent = await loginAs(employee);

        await agent.post('/api/slots').send(slotBody(at(0, 13), at(0, 14), ['A', 'B'])).expect(201);
    });

    it('accepts slots with any start time and duration', async () => {
        const agent = await loginAs(employee);

        await agent.post('/api/slots').send(slotBody(at(0, 10, 15), at(0, 10, 45), ['A'])).expect(201);
        await agent.post('/api/slots').send(slotBody(at(1, 6), at(1, 11, 30), ['A'])).expect(201);
    });

    it('allows a different set of tables at lunch and at dinner', async () => {
        const agent = await loginAs(employee);

        const dinner = await agent.post('/api/slots').send(slotBody(at(0, 19), at(0, 21), ['C', 'D'])).expect(201);

        expect(dinner.body.total_seats).toBe(14);
        expect(dinner.body.tables.map((t) => t.table_id).sort()).toEqual([tableIds.C, tableIds.D].sort());
    });

    it('reuses the table list of a previous slot', async () => {
        const agent = await loginAs(employee);
        const [previous] = (await agent.get(`/api/slots?from=${at(0, 19)}&to=${at(0, 21)}`).expect(200)).body;

        const res = await agent.post('/api/slots').send({
            date_time_start: at(2, 19),
            date_time_end: at(2, 21),
            table_ids: previous.tables.map((t) => t.table_id),
        }).expect(201);

        expect(res.body.tables).toEqual(previous.tables);
        expect(res.body.total_seats).toBe(previous.total_seats);
    });

    it('responds 409 if the slot overlaps an existing one', async () => {
        const agent = await loginAs(employee);

        const res = await agent.post('/api/slots').send(slotBody(at(0, 12, 30), at(0, 13, 30), ['A'])).expect(409);

        expect(res.body.error).toBe('The slot overlaps with an existing slot');
        expect(await prisma.slot.count({ where: { date_time_start: new Date(at(0, 12, 30)) } })).toBe(0);
    });

    it('responds 422 if a table does not exist', async () => {
        const agent = await loginAs(employee);

        await agent.post('/api/slots').send({
            date_time_start: at(3, 12),
            date_time_end: at(3, 13),
            table_ids: [tableIds.A, crypto.randomUUID()],
        }).expect(422);

        expect(await prisma.slot.count({ where: { date_time_start: new Date(at(3, 12)) } })).toBe(0);
    });

    it('responds 422 if the data is not valid', async () => {
        const agent = await loginAs(employee);

        // ends before it starts
        await agent.post('/api/slots').send(slotBody(at(3, 13), at(3, 12), ['A'])).expect(422);
        // starts in the past
        await agent.post('/api/slots').send(slotBody('2020-01-01T12:00:00Z', '2020-01-01T13:00:00Z', ['A'])).expect(422);
        // tables is not a list of ids
        await agent.post('/api/slots').send({ date_time_start: at(3, 12), date_time_end: at(3, 13), table_ids: 'A' }).expect(422);
    });
});

describe('GET /api/slots', () => {
    it('returns the slots of a period ordered by start time, with their tables', async () => {
        const agent = await loginAs(employee);

        const res = await agent.get(`/api/slots?from=${at(0, 0)}&to=${at(1, 0)}`).expect(200);

        expect(res.body.map((s) => s.date_time_start)).toEqual([at(0, 10, 15), at(0, 12), at(0, 13), at(0, 19)]);
        expect(res.body.map((s) => s.total_seats)).toEqual([4, 6, 6, 14]);
    });

    it('returns a single slot', async () => {
        const agent = await loginAs(employee);
        const [lunch] = (await agent.get(`/api/slots?from=${at(0, 12)}&to=${at(0, 13)}`).expect(200)).body;

        const res = await agent.get(`/api/slots/${lunch.slot_id}`).expect(200);

        expect(res.body).toEqual(lunch);
    });

    it('responds 404 if the slot does not exist', async () => {
        const agent = await loginAs(employee);
        await agent.get(`/api/slots/${crypto.randomUUID()}`).expect(404);
    });
});

describe('PUT /api/slots/:slotId', () => {
    let slotId;

    beforeAll(async () => {
        const agent = await loginAs(employee);
        const res = await agent.post('/api/slots').send(slotBody(at(4, 12), at(4, 13), ['A'])).expect(201);
        slotId = res.body.slot_id;
    });

    it('changes the times and the whole list of tables', async () => {
        const agent = await loginAs(employee);

        const res = await agent.put(`/api/slots/${slotId}`).send(slotBody(at(4, 12, 30), at(4, 14), ['B', 'C'])).expect(200);

        expect(res.body).toMatchObject({ date_time_start: at(4, 12, 30), date_time_end: at(4, 14), total_seats: 8 });
        expect(await linkedTables(slotId)).toEqual([tableIds.B, tableIds.C].sort());
    });

    it('responds 409 if the new times overlap another slot', async () => {
        const agent = await loginAs(employee);
        await agent.post('/api/slots').send(slotBody(at(4, 19), at(4, 21), ['A'])).expect(201);

        await agent.put(`/api/slots/${slotId}`).send(slotBody(at(4, 20), at(4, 22), ['B', 'C'])).expect(409);

        const saved = await prisma.slot.findUnique({ where: { slot_id: slotId } });
        expect(saved.date_time_start.toISOString()).toBe(at(4, 12, 30));
    });

    it('responds 404 if the slot does not exist', async () => {
        const agent = await loginAs(employee);
        await agent.put(`/api/slots/${crypto.randomUUID()}`).send(slotBody(at(5, 12), at(5, 13), ['A'])).expect(404);
    });
});

// The capacity defined by the employee is the one used when hikers book
describe('Slot capacity and reservations', () => {
    let slotId;

    beforeAll(async () => {
        const agent = await loginAs(employee);
        const res = await agent.post('/api/slots').send(slotBody(at(6, 12), at(6, 13), ['B'])).expect(201);
        slotId = res.body.slot_id;
    });

    it('does not accept more customers than the seats of the slot', async () => {
        const agent = await loginAs(hiker);

        await agent.post(`/api/slots/${slotId}/reservations`).send({ people: 3 }).expect(400);
        await agent.post(`/api/slots/${slotId}/reservations`).send({ people: 2 }).expect(201);
    });

    it('responds 409 when removing a table that has reservations', async () => {
        const agent = await loginAs(employee);

        const res = await agent.put(`/api/slots/${slotId}`).send(slotBody(at(6, 12), at(6, 13), ['A'])).expect(409);

        expect(res.body.error).toBe('Cannot remove a table that has reservations in this slot');
        expect(await linkedTables(slotId)).toEqual([tableIds.B]);
    });

    it('lets the employee add tables to a slot that has reservations', async () => {
        const employeeAgent = await loginAs(employee);
        await employeeAgent.put(`/api/slots/${slotId}`).send(slotBody(at(6, 12), at(6, 13), ['B', 'A'])).expect(200);

        const hikerAgent = await loginAs(hiker);
        const res = await hikerAgent.get(`/api/slots/${slotId}/availability?partySize=4`).expect(200);

        expect(res.body.totalAvailableSeats).toBe(4);
    });

    it('responds 409 when deleting a slot that has reservations', async () => {
        const agent = await loginAs(employee);

        await agent.delete(`/api/slots/${slotId}`).expect(409);

        expect(await prisma.slot.count({ where: { slot_id: slotId } })).toBe(1);
    });
});

describe('DELETE /api/slots/:slotId', () => {
    it('deletes a slot without reservations', async () => {
        const agent = await loginAs(employee);
        const created = await agent.post('/api/slots').send(slotBody(at(7, 12), at(7, 13), ['A', 'B'])).expect(201);
        const slotId = created.body.slot_id;

        await agent.delete(`/api/slots/${slotId}`).expect(204);

        await agent.get(`/api/slots/${slotId}`).expect(404);
        expect(await linkedTables(slotId)).toEqual([]);
    });

    it('responds 404 if the slot does not exist', async () => {
        const agent = await loginAs(employee);
        await agent.delete(`/api/slots/${crypto.randomUUID()}`).expect(404);
    });

    it('responds 422 if the slot id is not valid', async () => {
        const agent = await loginAs(employee);
        await agent.delete('/api/slots/not-a-uuid').expect(422);
    });
});
