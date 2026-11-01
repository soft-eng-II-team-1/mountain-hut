import request from 'supertest';
import app from '../../app.js';
import UserDAO from '../../dao/UserDAO.js';
import { prisma } from '../../../prisma.client.ts';

const stamp = Date.now();
const warden = { email: `warden.${stamp}@test.it`, password: 'warden123' };
const hiker = { email: `hiker.${stamp}@test.it`, password: 'password123' };
const employee = {
    name: 'Luca',
    surname: 'Verdi',
    email: `employee.${stamp}@test.it`,
    password: 'employee123',
};

beforeAll(async () => {
    const userDao = new UserDAO();
    await userDao.createUser({ name: 'Test', surname: 'Warden', ...warden, role: 'warden' });
    await userDao.createUser({ name: 'Test', surname: 'Hiker', ...hiker });
});

afterAll(async () => {
    await prisma.user.deleteMany({
        where: { email: { in: [warden.email, hiker.email, employee.email] } },
    });
    await prisma.$disconnect();
});

// Helper: returns an agent that keeps the session cookie of the given user
const loginAs = async (credentials) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);
    return agent;
};

describe('POST /api/warden/employees', () => {
    it('responds 403 if not logged in', async () => {
        await request(app).post('/api/warden/employees').send(employee).expect(403);
    });

    it('responds 403 if logged in as hiker', async () => {
        const agent = await loginAs(hiker);
        await agent.post('/api/warden/employees').send(employee).expect(403);
    });

    it('creates an employee as warden and keeps the warden session', async () => {
        const agent = await loginAs(warden);

        const res = await agent.post('/api/warden/employees').send(employee).expect(201);
        expect(res.body).toMatchObject({ email: employee.email, role: 'employee' });
        expect(res.body).not.toHaveProperty('hash');
        expect(res.body).not.toHaveProperty('salt');

        const me = await agent.get('/api/auth/user').expect(200);
        expect(me.body).toMatchObject({ email: warden.email, role: 'warden' });
    });

    it('responds 409 if the email is already registered', async () => {
        const agent = await loginAs(warden);
        await agent.post('/api/warden/employees').send(employee).expect(409);
    });

    it('responds 422 if the data is not valid', async () => {
        const agent = await loginAs(warden);
        await agent
            .post('/api/warden/employees')
            .send({ name: '', surname: 'Verdi', email: 'not-an-email', password: '1' })
            .expect(422);
    });

    it('creates an employee that can log in with role employee', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: employee.email, password: employee.password })
            .expect(200);

        expect(res.body.role).toBe('employee');
    });
});