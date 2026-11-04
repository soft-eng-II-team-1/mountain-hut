import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../app.js';
import UserDAO from '../../dao/UserDAO.js';
import { prisma } from '../../../prisma.client.ts';

const stamp = Date.now();

const employee = { email: `employee.tables.${stamp}@test.it`, password: 'employee123' };
const warden = { email: `warden.tables.${stamp}@test.it`, password: 'warden123' };
const hiker = { email: `hiker.tables.${stamp}@test.it`, password: 'password123' };

// All the test tables have a unique number, so they do not clash with the seed and are removed at the end
const tableNumber = (key) => `T-${stamp}-${key}`;
const slotIds = [];

// Helper: returns an agent that keeps the session cookie of the given user
const loginAs = async (credentials) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);
    return agent;
};

beforeAll(async () => {
    const userDao = new UserDAO();
    await userDao.createUser({ name: 'Test', surname: 'Employee', ...employee, role: 'employee' });
    await userDao.createUser({ name: 'Test', surname: 'Warden', ...warden, role: 'warden' });
    await userDao.createUser({ name: 'Test', surname: 'Hiker', ...hiker });
});

afterAll(async () => {
    await prisma.slot_table.deleteMany({ where: { slot_id: { in: slotIds } } });
    await prisma.slot.deleteMany({ where: { slot_id: { in: slotIds } } });
    await prisma.table.deleteMany({ where: { number: { startsWith: `T-${stamp}-` } } });
    await prisma.user.deleteMany({ where: { email: { in: [employee.email, warden.email, hiker.email] } } });
    await prisma.$disconnect();
});

describe('Table management - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).post('/api/tables').send({ number: tableNumber('X'), seats: 4 }).expect(401);
    });

    it('responds 403 if logged in as hiker', async () => {
        const agent = await loginAs(hiker);

        await agent.post('/api/tables').send({ number: tableNumber('X'), seats: 4 }).expect(403);
        await agent.delete(`/api/tables/${crypto.randomUUID()}`).expect(403);

        expect(await prisma.table.count({ where: { number: tableNumber('X') } })).toBe(0);
    });
});

describe('POST /api/tables', () => {
    it('creates a table with its number and seats', async () => {
        const agent = await loginAs(employee);

        const res = await agent.post('/api/tables').send({ number: tableNumber('1'), seats: 4 }).expect(201);

        expect(res.body).toMatchObject({ number: tableNumber('1'), seats: 4 });
        const saved = await prisma.table.findUnique({ where: { table_id: res.body.table_id } });
        expect(saved).toMatchObject({ number: tableNumber('1'), seats: 4 });
    });

    it('lets the warden create a table', async () => {
        const agent = await loginAs(warden);
        await agent.post('/api/tables').send({ number: tableNumber('2'), seats: 2 }).expect(201);
    });

    it('responds 409 if the table number already exists', async () => {
        const agent = await loginAs(employee);

        await agent.post('/api/tables').send({ number: tableNumber('1'), seats: 6 }).expect(409);

        expect(await prisma.table.count({ where: { number: tableNumber('1') } })).toBe(1);
    });

    it('responds 422 if the data is not valid', async () => {
        const agent = await loginAs(employee);

        await agent.post('/api/tables').send({}).expect(422);
        await agent.post('/api/tables').send({ number: tableNumber('3') }).expect(422);
        await agent.post('/api/tables').send({ number: tableNumber('3'), seats: '4' }).expect(422);
        await agent.post('/api/tables').send({ number: tableNumber('3'), seats: 0 }).expect(422);
        await agent.post('/api/tables').send({ number: 3, seats: 4 }).expect(422);

        expect(await prisma.table.count({ where: { number: tableNumber('3') } })).toBe(0);
    });

    it('responds 422 if the seats are negative', async () => {
        const agent = await loginAs(employee);

        await agent.post('/api/tables').send({ number: tableNumber('neg'), seats: -3 }).expect(422);

        expect(await prisma.table.count({ where: { number: tableNumber('neg') } })).toBe(0);
    });

    it('responds 422 if the seats are not an integer', async () => {
        const agent = await loginAs(employee);

        await agent.post('/api/tables').send({ number: tableNumber('dec'), seats: 2.5 }).expect(422);

        expect(await prisma.table.count({ where: { number: tableNumber('dec') } })).toBe(0);
    });
});

describe('GET /api/tables', () => {
    it('returns the list of all the tables', async () => {
        const agent = await loginAs(employee);

        const res = await agent.get('/api/tables').expect(200);

        expect(res.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ number: tableNumber('1'), seats: 4 }),
        ]));
    });
});

describe('PUT /api/tables/:tableId', () => {
    let tableId;

    beforeAll(async () => {
        const agent = await loginAs(employee);
        const res = await agent.post('/api/tables').send({ number: tableNumber('4'), seats: 4 }).expect(201);
        tableId = res.body.table_id;
    });

    it('changes the number and the seats of a table', async () => {
        const agent = await loginAs(employee);

        const res = await agent.put(`/api/tables/${tableId}`).send({ number: tableNumber('4b'), seats: 6 }).expect(200);

        expect(res.body).toEqual({ table_id: tableId, number: tableNumber('4b'), seats: 6 });
        const saved = await prisma.table.findUnique({ where: { table_id: tableId } });
        expect(saved).toMatchObject({ number: tableNumber('4b'), seats: 6 });
    });

    it('responds 409 if the new number is used by another table', async () => {
        const agent = await loginAs(employee);
        await agent.put(`/api/tables/${tableId}`).send({ number: tableNumber('1'), seats: 6 }).expect(409);
    });

    it('responds 422 if the data is not valid', async () => {
        const agent = await loginAs(employee);
        await agent.put(`/api/tables/${tableId}`).send({ number: tableNumber('4b') }).expect(422);
    });

    it('responds 404 if the table does not exist', async () => {
        const agent = await loginAs(employee);
        await agent.put(`/api/tables/${crypto.randomUUID()}`).send({ number: tableNumber('5'), seats: 2 }).expect(404);
    });

    it('responds 422 if the table id is not a valid UUID', async () => {
        const agent = await loginAs(employee);

        const res = await agent.put('/api/tables/not-a-uuid').send({ number: tableNumber('5'), seats: 2 }).expect(422);

        expect(JSON.stringify(res.body)).not.toMatch(/prisma/i);
    });
});

describe('DELETE /api/tables/:tableId', () => {
    it('deletes a table that is not used by any slot', async () => {
        const agent = await loginAs(employee);
        const created = await agent.post('/api/tables').send({ number: tableNumber('6'), seats: 2 }).expect(201);

        await agent.delete(`/api/tables/${created.body.table_id}`).expect(204);

        expect(await prisma.table.count({ where: { table_id: created.body.table_id } })).toBe(0);
    });

    it('responds 400 if the table is used by a slot', async () => {
        const agent = await loginAs(employee);
        const created = await agent.post('/api/tables').send({ number: tableNumber('7'), seats: 4 }).expect(201);
        const tableId = created.body.table_id;

        // Slot far in the future that uses the table
        const slotId = crypto.randomUUID();
        slotIds.push(slotId);
        await prisma.slot.create({
            data: {
                slot_id: slotId,
                date_time_start: new Date('2200-01-01T12:00:00Z'),
                date_time_end: new Date('2200-01-01T13:00:00Z'),
            },
        });
        await prisma.slot_table.create({ data: { id: crypto.randomUUID(), slot_id: slotId, table_id: tableId } });

        const res = await agent.delete(`/api/tables/${tableId}`).expect(400);

        expect(res.body.error).toBe('Cannot delete a table that is scheduled in a slot or has active reservations');
        expect(await prisma.table.count({ where: { table_id: tableId } })).toBe(1);
    });

    it('responds 404 if the table does not exist', async () => {
        const agent = await loginAs(employee);
        await agent.delete(`/api/tables/${crypto.randomUUID()}`).expect(404);
    });

    it('responds 422 if the table id is not a valid UUID', async () => {
        const agent = await loginAs(employee);

        const res = await agent.delete('/api/tables/not-a-uuid').expect(422);

        expect(JSON.stringify(res.body)).not.toMatch(/prisma/i);
    });
});
