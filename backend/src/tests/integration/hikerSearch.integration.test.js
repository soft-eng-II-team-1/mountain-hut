import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../../prisma.client.ts';

const users = {};
const stamp = Date.now();
//letters only for name/surname to satisfy validator regex
const stampLetters = stamp.toString().split('').map(d => String.fromCharCode(97 + Number(d))).join('');
const PASSWORD = 'password123';

//user in DB
const createUser = async (key, role, data = {}) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex'); // same as UserDAO
    const user = await prisma.user.create({
        data: {
            user_id: crypto.randomUUID(),
            role,
            name: data.name ?? 'Test',
            surname: data.surname ?? key,
            email: data.email ?? `${key}.${stamp}@test.it`.toLowerCase(),
            phone: data.phone ?? null,
            hash,
            salt,
        },
    });
    users[key] = user;
    return user;
};

//login
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

//beforeall
beforeAll(async () => {
    //staff users
    await createUser('employee', 'employee');
    await createUser('warden', 'warden');
    await createUser('hiker', 'hiker');

    //hiker users to search for
    await createUser('mario', 'hiker', {
        name: `Mario`,
        surname: `Rossi${stampLetters}`,
        email: `mario.rossi.${stamp}@test.it`,
        phone: '+39 333 1112233',
    });

    await createUser('luigi', 'hiker', {
        name: `Luigi`,
        surname: `Rossi${stampLetters}`,
        email: `luigi.rossi.${stamp}@test.it`,
        phone: '+39 333 4445566',
    });

    await createUser('giulia', 'hiker', {
        name: `Giulia`,
        surname: `Bianchi${stampLetters}`,
        email: `giulia.bianchi.${stamp}@test.it`,
        phone: '+39 02 998877',
    });

    //employee with similar surname to check role filtering
    await createUser('staffExcluded', 'employee', {
        name: `Paolo`,
        surname: `Rossi${stampLetters}`,
        email: `paolo.staff.${stamp}@test.it`,
        phone: '+39 333 9990000',
    });
});

//afterall: clean
afterAll(async () => {
    await prisma.user.deleteMany({
        where: { user_id: { in: Object.values(users).map((u) => u.user_id) } },
    });
    await prisma.$disconnect();
});

//SEARCH HIKERS SUCCESSFULLY
describe('GET /api/hikers - search hikers', () => {
    //SEARCH BY EXACT EMAIL
    it('employee searches by exact email, returns 200 with the matching hiker', async () => {
        const agent = await loginAs('employee');

        const res = await agent
            .get('/api/hikers')
            .query({ email: `mario.rossi.${stamp}@test.it` })
            .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].email).toBe(`mario.rossi.${stamp}@test.it`);
        expect(res.body[0].name).toBe('Mario');
        expect(res.body[0].surname).toBe(`Rossi${stampLetters}`);
        //security: no password hash or salt returned
        expect(res.body[0].hash).toBeUndefined();
        expect(res.body[0].salt).toBeUndefined();
    });

    //WARDEN CAN SEARCH HIKERS
    it('warden searches by email, returns 200', async () => {
        const agent = await loginAs('warden');

        const res = await agent
            .get('/api/hikers')
            .query({ email: `giulia.bianchi.${stamp}@test.it` })
            .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('Giulia');
    });

    //SEARCH BY NAME / SURNAME PARTIAL MATCH
    it('employee searches by surname, returns all matching hikers ordered by surname and name', async () => {
        const agent = await loginAs('employee');

        const res = await agent
            .get('/api/hikers')
            .query({ name: `Rossi${stampLetters}` })
            .expect(200);

        //must find Luigi and Mario, but NOT Paolo (who is an employee)
        expect(res.body).toHaveLength(2);
        expect(res.body[0].name).toBe('Luigi');
        expect(res.body[1].name).toBe('Mario');
    });

    //SEARCH BY PHONE PARTIAL MATCH
    it('employee searches by phone ignoring spaces, returns 200', async () => {
        const agent = await loginAs('employee');

        const res = await agent
            .get('/api/hikers')
            .query({ phone: '333 111' })
            .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].email).toBe(`mario.rossi.${stamp}@test.it`);
    });

    //SEARCH COMBINING MULTIPLE CRITERIA (AND)
    it('employee searches with combined name and phone criteria, returns 200', async () => {
        const agent = await loginAs('employee');

        const res = await agent
            .get('/api/hikers')
            .query({ name: `Rossi${stampLetters}`, phone: '4445566' })
            .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('Luigi');
    });

    //SEARCH NO RESULTS
    it('returns empty array when no hiker matches the criteria', async () => {
        const agent = await loginAs('employee');

        const res = await agent
            .get('/api/hikers')
            .query({ email: `nonexistent.${stamp}@test.it` })
            .expect(200);

        expect(res.body).toEqual([]);
    });
});

//VALIDATION TESTS
describe('GET /api/hikers - validation', () => {
    //MISSING ALL CRITERIA
    it('responds 422 if no search criteria are provided', async () => {
        const agent = await loginAs('employee');

        await agent.get('/api/hikers').expect(422);
    });

    //EMAIL NOT VALID
    it('responds 422 if email is not valid', async () => {
        const agent = await loginAs('employee');

        await agent.get('/api/hikers').query({ email: 'not-an-email' }).expect(422);
    });

    //NAME TOO SHORT
    it('responds 422 if name is less than 2 characters', async () => {
        const agent = await loginAs('employee');

        await agent.get('/api/hikers').query({ name: 'a' }).expect(422);
    });

    //NAME WITH INVALID CHARACTERS
    it('responds 422 if name contains digits or special characters', async () => {
        const agent = await loginAs('employee');

        await agent.get('/api/hikers').query({ name: 'Mario123' }).expect(422);
    });

    //PHONE NUMBER NOT VALID
    it('responds 422 if phone number contains letters or too few digits', async () => {
        const agent = await loginAs('employee');

        await agent.get('/api/hikers').query({ phone: 'abc' }).expect(422);
        await agent.get('/api/hikers').query({ phone: '+12' }).expect(422);
    });
});

//AUTHORIZATION TESTS
describe('GET /api/hikers - authorization', () => {
    //HIKER CANNOT SEARCH HIKERS
    it('responds 403 if logged in as hiker', async () => {
        const agent = await loginAs('hiker');

        await agent.get('/api/hikers').query({ name: 'Mario' }).expect(403);
    });

    //NOT LOGGED IN (no session)
    it('responds 401 if not logged in', async () => {
        await request(app).get('/api/hikers').query({ name: 'Mario' }).expect(401);
    });
});
