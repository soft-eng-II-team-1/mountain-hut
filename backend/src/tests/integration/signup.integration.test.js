import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../../prisma.client.ts';

const stamp = Date.now();
const email = `hiker.${stamp}@test.it`;
const roleAttemptEmail = `role.${stamp}@test.it`;
const password = 'password123';

afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, roleAttemptEmail] } } });
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
});