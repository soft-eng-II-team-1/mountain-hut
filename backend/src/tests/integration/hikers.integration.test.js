import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../../prisma.client.ts';

const users = {};
const stamp = Date.now();
const PASSWORD = 'password123';
//created email -> to be cleaned
const createdHikerEmails = [];

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

//login
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

//beforeall
beforeAll(async () => {
    await createUser('employee', 'employee');
    await createUser('warden', 'warden');
    await createUser('hiker', 'hiker');
});

//afterall: clean
afterAll(async () => {
    if (createdHikerEmails.length) {
        await prisma.user.deleteMany({ where: { email: { in: createdHikerEmails } } });
    }
    await prisma.user.deleteMany({ where: { user_id: { in: Object.values(users).map(u => u.user_id) } } });
    await prisma.$disconnect();
});

//HIKER SUCCESSFULLY CREATED BY AN EMPLOYEE
describe('POST /api/hikers', () => {
    it('respond 201 if created with full details', async () => {
        const agent = await loginAs('employee');
        const hikerEmail = `newhiker.${stamp}@test.it`;
        createdHikerEmails.push(hikerEmail);

        const res = await agent
            .post('/api/hikers')
            .send({
                name: 'Mario',
                surname: 'Rossi',
                email: hikerEmail,
                phone: '+393331234567',
                notes: 'Vegetarian',
                emergency_contact: 'Luigi +39333999888',
            })
            .expect(201);

        expect(res.body).toMatchObject({ email: hikerEmail, role: 'hiker' });
        expect(res.body.generated_password).toBeDefined();
        expect(res.body.generated_password).toHaveLength(10);
        expect(res.headers['cache-control']).toBe('no-store'); //cache

        //first login
        const saved = await prisma.user.findUnique({ where: { email: hikerEmail } });

        expect(saved.first_login).toBe(true);
        expect(saved.role).toBe('hiker');
    });

    //WARDEN CREATES AN HIKER
    it('respond 201 if created by a warden', async () => {
        const agent = await loginAs('warden');
        const hikerEmail = `wardenhiker.${stamp}@test.it`;
        createdHikerEmails.push(hikerEmail);

        const res = await agent.post('/api/hikers').send({ name: 'Anna', surname: 'Verdi', email: hikerEmail }).expect(201);
        //no optional feld to test if they are actually optional
        expect(res.body).toMatchObject({ role: 'hiker' });
        expect(res.body.generated_password).toBeDefined();
    });

    //RANDOM PASSWORD WORKS
    it('respond 200 if the hicker can log in with random password', async () => {
        const agent = await loginAs('employee');
        const hikerEmail = `loginhiker.${stamp}@test.it`;
        createdHikerEmails.push(hikerEmail);

        const created = await agent.post('/api/hikers').send({ name: 'Luca', surname: 'Neri', email: hikerEmail }).expect(201);

        //log in
        const hikerAgent = request.agent(app);
        await hikerAgent.post('/api/auth/login').send({ email: hikerEmail, password: created.body.generated_password }).expect(200);
    });

    //HIKER CANNOT CREATE AN HIKER
    it('responds 403 if logged in as hiker', async () => {
        const agent = await loginAs('hiker');

        await agent.post('/api/hikers').send({ name: 'Test', surname: 'Fail', email: `fail.${stamp}@test.it` }).expect(403);
    });

    //HIKER NOT LOGGED IN (no session)
    it('responds 401 if not logged in', async () => {
        await request(app).post('/api/hikers').send({ name: 'Test', surname: 'Fail', email: `noauth.${stamp}@test.it` }).expect(401);
    });
});

//Validation tests: API should reject wrong data
describe('POST /api/hikers - validation', () => {
    //NAME MISSING
    it('responds 422 if name is missing', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ surname: 'Rossi', email: `noname.${stamp}@test.it` }).expect(422);
    });

    //SURNAME MISSING
    it('responds 422 if surname is missing', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ name: 'Mario', email: `nosurname.${stamp}@test.it` }).expect(422);
    });

    //EMAIL MISSING
    it('responds 422 if email is missing', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ name: 'Mario', surname: 'Rossi' }).expect(422);
    });

    //EMAIL NOT VALID
    it('responds 422 if email is not valid', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ name: 'Mario', surname: 'Rossi', email: 'not-an-email' }).expect(422);
    });

    //PHONE NUMBER NOT VALID
    it('responds 422 if phone number is not valid', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ name: 'Mario', surname: 'Rossi', email: `phone.${stamp}@test.it`, phone: 'abc' }).expect(422);
    });

    //NOTE TOO LONG
    it('responds 422 if notes exceed 256 characters', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ name: 'Mario', surname: 'Rossi', email: `notes.${stamp}@test.it`, notes: 'a'.repeat(257) }).expect(422);
    });

    //EMAIL ALREADY EXISTS
    it('responds 409 if email already exists', async () => {
        const agent = await loginAs('employee');
        await agent.post('/api/hikers').send({ name: 'Altro', surname: 'Utente', email: `newhiker.${stamp}@test.it` }).expect(409);
    });
});

//Security tests
describe('POST /api/hikers - security', () => {
    //REJECT WARDEN ACCOUNT CREATION: HIKER IS HARDCODED
    it('ignores role in the request body, always creates a hiker', async () => {
        const agent = await loginAs('employee');
        const hikerEmail = `roletest.${stamp}@test.it`;
        createdHikerEmails.push(hikerEmail);

        const res = await agent.post('/api/hikers').send({ name: 'Test', surname: 'Role', email: hikerEmail, role: 'warden' }).expect(201);
        expect(res.body.role).toBe('hiker');
    });

    //USE THE GENERATED PASSWORD - ONLY ONE THAT WORKS
    it('ignores password in the body, uses the generated one', async () => {
        const agent = await loginAs('employee');
        const hikerEmail = `pwdtest.${stamp}@test.it`;
        createdHikerEmails.push(hikerEmail);

        const res = await agent.post('/api/hikers').send({ name: 'Test', surname: 'Pwd', email: hikerEmail, password: 'miapassword123' }).expect(201);

        expect(res.body.generated_password).not.toBe('miapassword123');

        await request(app).post('/api/auth/login').send({ email: hikerEmail, password: res.body.generated_password }).expect(200);
        await request(app).post('/api/auth/login').send({ email: hikerEmail, password: 'miapassword123' }).expect(401);
    });

    //FIRST LOGIN FORCED
    it('ignores first_login in the request body, always sets it to true', async () => {
        const agent = await loginAs('employee');
        const hikerEmail = `flogin.${stamp}@test.it`;
        createdHikerEmails.push(hikerEmail);

        await agent.post('/api/hikers').send({ name: 'Test', surname: 'Login', email: hikerEmail, first_login: false }).expect(201);

        const saved = await prisma.user.findUnique({ where: { email: hikerEmail } });
        expect(saved.first_login).toBe(true);
    });

});

