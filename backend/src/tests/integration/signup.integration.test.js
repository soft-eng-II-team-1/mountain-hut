import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../../prisma.client.ts';

const stamp = Date.now();
const email = `hiker.${stamp}@test.it`;
const roleAttemptEmail = `role.${stamp}@test.it`;
const password = 'password123';

const extraEmail = `extra.${stamp}@test.it`;

afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, roleAttemptEmail, extraEmail] } } });
    await prisma.$disconnect();
});

describe('POST /api/auth/signup', () => {
    it('creates a hiker, responds 201 and opens the session', async () => {
        const agent = request.agent(app);

        const res = await agent
            .post('/api/auth/signup')
            .send({ name: 'Anna', surname: 'Bianchi', email, password })
            .expect(201);

        expect(res.body).toMatchObject({ email, role: 'hiker' });
        expect(res.body).not.toHaveProperty('hash');
        expect(res.body).not.toHaveProperty('salt');

        const me = await agent.get('/api/auth/user').expect(200);
        expect(me.body.email).toBe(email);
    });

    it('ignores a role sent in the request body', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send({ name: 'Test', surname: 'User', email: roleAttemptEmail, password, role: 'warden' })
            .expect(201);

        expect(res.body.role).toBe('hiker');
    });

    it('responds 409 if the email is already registered', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({ name: 'Anna', surname: 'Bianchi', email, password })
            .expect(409);
    });

    it('responds 422 if a required field is missing', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({ surname: 'Bianchi', email: `missing.${stamp}@test.it`, password })
            .expect(422);
    });

    it('responds 422 if the email is not valid', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({ name: 'Anna', surname: 'Bianchi', email: 'not-an-email', password })
            .expect(422);
    });

    it('responds 422 if the password is too short', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({ name: 'Anna', surname: 'Bianchi', email: `short.${stamp}@test.it`, password: '123' })
            .expect(422);
    });

    it('saves notes and emergency contact', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({ name: 'Anna', surname: 'Bianchi', email: extraEmail, password,
                    notes: 'Registered mountain guide', emergency_contact: 'Marco +39333111222' })
            .expect(201);

        const saved = await prisma.user.findUnique({ where: { email: extraEmail } });
        expect(saved.notes).toBe('Registered mountain guide');
        expect(saved.emergency_contact).toBe('Marco +39333111222');
    });

    it('responds 422 if notes are too long', async () => {
        await request(app)
            .post('/api/auth/signup')
            .send({ name: 'Anna', surname: 'Bianchi', email: `long.${stamp}@test.it`, password, notes: 'a'.repeat(300) })
            .expect(422);
    });

});