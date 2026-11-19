import { jest } from '@jest/globals';
import crypto from 'node:crypto';

// The SMTP server is the only part that is replaced: routes, DAO, recovery service,
// mailer.js and the database are the real ones. Every email is captured in sendMail.mock.calls
const sendMail = jest.fn();
const nodemailerMock = {
    createTransport: jest.fn(() => ({ sendMail })),
    createTestAccount: jest.fn(async () => ({ user: 'test-user', pass: 'test-pass' })),
    getTestMessageUrl: jest.fn(() => false),
};
jest.unstable_mockModule('nodemailer', () => ({ default: nodemailerMock }));

const { default: request } = await import('supertest');
const { default: app } = await import('../../app.js');
const { prisma } = await import('../../../prisma.client.ts');

const stamp = Date.now();
const PASSWORD = 'password123';
const NEW_PASSWORD = 'newPassword456';
const TEN_MINUTES = 10 * 60 * 1000;
const GENERIC_MESSAGE = 'If an account exists for this email, recovery instructions will be sent';

const users = {};

// same derivation as UserDAO
const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
};

const createUser = async (key) => {
    users[key] = await prisma.user.create({
        data: {
            user_id: crypto.randomUUID(),
            role: 'hiker',
            name: key,
            surname: 'Test',
            email: `pwd.${key}.${stamp}@test.it`,
            ...hashPassword(PASSWORD),
        },
    });
};

const userIds = () => Object.values(users).map((user) => user.user_id);

const login = (key, password) =>
    request(app).post('/api/auth/login').send({ email: users[key].email, password });

// Returns an agent that keeps the session cookie of the given user
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

const requestCode = (email) =>
    request(app).post('/api/auth/password-reset/request').send({ email });

const confirmReset = (email, recoveryCode, newPassword = NEW_PASSWORD) =>
    request(app).post('/api/auth/password-reset/confirm').send({ email, recoveryCode, newPassword });

// Recovery code of the last email sent: it is alone on its own line in the text part
const lastCode = () => sendMail.mock.calls.at(-1)[0].text.match(/^\d{10}$/m)[0];

const otpOf = (key) => prisma.otp_user.findUnique({ where: { user_id: users[key].user_id } });

beforeAll(async () => {
    for (const key of ['anna', 'marco', 'luca']) {
        await createUser(key);
    }
});

// Every test starts from: password = PASSWORD, no recovery code, no email sent
beforeEach(async () => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    await prisma.otp_user.deleteMany({ where: { user_id: { in: userIds() } } });
    for (const user of Object.values(users)) {
        await prisma.user.update({ where: { user_id: user.user_id }, data: hashPassword(PASSWORD) });
    }
});

afterAll(async () => {
    // otp_user references user (onDelete: NoAction): delete it first
    await prisma.otp_user.deleteMany({ where: { user_id: { in: userIds() } } });
    await prisma.user.deleteMany({ where: { user_id: { in: userIds() } } });
    await prisma.$disconnect();
});

describe('PUT /api/auth/password', () => {
    it('responds 401 if nobody is logged in', async () => {
        await request(app)
            .put('/api/auth/password')
            .send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD })
            .expect(401);
    });

    it('changes the password: the new one works, the old one does not', async () => {
        const agent = await loginAs('anna');

        await agent.put('/api/auth/password').send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);

        await login('anna', NEW_PASSWORD).expect(200);
        await login('anna', PASSWORD).expect(401);
    });

    it('keeps the user logged in after the change', async () => {
        const agent = await loginAs('anna');

        await agent.put('/api/auth/password').send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);

        const me = await agent.get('/api/auth/user').expect(200);
        expect(me.body.email).toBe(users.anna.email);
    });

    it('stores a new salt and a hash of the new password', async () => {
        const before = await prisma.user.findUnique({ where: { user_id: users.anna.user_id } });
        const agent = await loginAs('anna');

        await agent.put('/api/auth/password').send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);

        const after = await prisma.user.findUnique({ where: { user_id: users.anna.user_id } });
        expect(after.salt).not.toBe(before.salt);
        expect(after.hash).toBe(crypto.scryptSync(NEW_PASSWORD, after.salt, 64).toString('hex'));
    });

    it('responds 401 and keeps the old password if the current password is wrong', async () => {
        const agent = await loginAs('anna');

        await agent.put('/api/auth/password').send({ oldPassword: 'wrongPassword', newPassword: NEW_PASSWORD }).expect(401);

        await login('anna', PASSWORD).expect(200);
        await login('anna', NEW_PASSWORD).expect(401);
    });

    it('responds 422 and keeps the old password if the new one is too short', async () => {
        const agent = await loginAs('anna');

        await agent.put('/api/auth/password').send({ oldPassword: PASSWORD, newPassword: 'short' }).expect(422);

        await login('anna', PASSWORD).expect(200);
    });

    it('changes only the password of the logged in user, ignoring an email in the body', async () => {
        const agent = await loginAs('anna');

        await agent.put('/api/auth/password')
            .send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD, email: users.marco.email })
            .expect(200);

        await login('marco', PASSWORD).expect(200);
        await login('anna', NEW_PASSWORD).expect(200);
    });
});

describe('POST /api/auth/password-reset/request', () => {
    it('responds 202 and emails a 10-digit code to the user', async () => {
        const res = await requestCode(users.anna.email).expect(202);

        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
        expect(sendMail).toHaveBeenCalledTimes(1);
        const message = sendMail.mock.calls[0][0];
        expect(message.to).toBe(users.anna.email);
        expect(message.subject).toBe('Mountain Hut - Password recovery code');
        expect(lastCode()).toMatch(/^\d{10}$/);
        expect(message.html).toContain(lastCode());
    });

    it('stores only a salted hash of the code, valid for 10 minutes', async () => {
        await requestCode(users.anna.email).expect(202);

        const otp = await otpOf('anna');
        expect(otp.hash).toBe(crypto.scryptSync(lastCode(), otp.salt, 64).toString('hex'));
        expect(otp.expires_at.getTime() - otp.created_at.getTime()).toBe(TEN_MINUTES);
        expect(otp.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('gives the same answer for an unknown email, without sending emails or saving codes', async () => {
        const known = await requestCode(users.anna.email).expect(202);
        sendMail.mockClear();

        const unknown = await requestCode(`nobody.${stamp}@test.it`).expect(202);

        expect(unknown.body).toEqual(known.body);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('accepts the email with different case and surrounding spaces', async () => {
        await requestCode(`  ${users.anna.email.toUpperCase()} `).expect(202);

        expect(sendMail.mock.calls[0][0].to).toBe(users.anna.email);
        expect(await otpOf('anna')).not.toBeNull();
    });

    it('replaces the previous code: only the last one works', async () => {
        await requestCode(users.anna.email).expect(202);
        const first = lastCode();
        await requestCode(users.anna.email).expect(202);
        const second = lastCode();

        expect(await prisma.otp_user.count({ where: { user_id: users.anna.user_id } })).toBe(1);
        await confirmReset(users.anna.email, first).expect(400);
        await confirmReset(users.anna.email, second).expect(200);
    });

    it('still responds 202 and keeps the code if the email cannot be sent', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        sendMail.mockRejectedValue(new Error('SMTP down'));

        const res = await requestCode(users.anna.email).expect(202);

        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
        expect(await otpOf('anna')).not.toBeNull();
        consoleError.mockRestore();
    });

    it('responds 422 if the email is not valid', async () => {
        await requestCode('not-an-email').expect(422);

        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('POST /api/auth/password-reset/confirm', () => {
    it('full flow: request a code, reset, log in with the new password', async () => {
        await requestCode(users.anna.email).expect(202);

        await confirmReset(users.anna.email, lastCode()).expect(200);

        await login('anna', NEW_PASSWORD).expect(200);
        await login('anna', PASSWORD).expect(401);
    });

    it('consumes the code: it cannot be used twice', async () => {
        await requestCode(users.anna.email).expect(202);
        const code = lastCode();

        await confirmReset(users.anna.email, code).expect(200);
        expect(await otpOf('anna')).toBeNull();

        await confirmReset(users.anna.email, code, 'anotherPassword789').expect(400);
        await login('anna', NEW_PASSWORD).expect(200);
    });

    it('rejects a wrong code, keeps the password, and the right code still works afterwards', async () => {
        await requestCode(users.anna.email).expect(202);
        const code = lastCode();
        const wrong = code === '0000000000' ? '1111111111' : '0000000000';

        const res = await confirmReset(users.anna.email, wrong).expect(400);

        expect(res.body).toEqual({ error: 'Password recovery not confirmed' });
        await login('anna', PASSWORD).expect(200);
        await confirmReset(users.anna.email, code).expect(200);
    });

    it('rejects an expired code and keeps the password', async () => {
        await requestCode(users.anna.email).expect(202);
        const code = lastCode();
        await prisma.otp_user.update({
            where: { user_id: users.anna.user_id },
            data: { expires_at: new Date(Date.now() - 1000) },
        });

        await confirmReset(users.anna.email, code).expect(400);

        await login('anna', PASSWORD).expect(200);
    });

    it('accepts a code that is about to expire', async () => {
        await requestCode(users.anna.email).expect(202);
        const code = lastCode();
        await prisma.otp_user.update({
            where: { user_id: users.anna.user_id },
            data: { expires_at: new Date(Date.now() + 60 * 1000) },
        });

        await confirmReset(users.anna.email, code).expect(200);
    });

    it('rejects the code of another user', async () => {
        await requestCode(users.anna.email).expect(202);
        const annaCode = lastCode();

        await confirmReset(users.marco.email, annaCode).expect(400);

        await login('marco', PASSWORD).expect(200);
        await confirmReset(users.anna.email, annaCode).expect(200);
    });

    it('rejects any code if none was requested', async () => {
        await confirmReset(users.luca.email, '0123456789').expect(400);

        await login('luca', PASSWORD).expect(200);
    });

    it('rejects an unknown email', async () => {
        await confirmReset(`nobody.${stamp}@test.it`, '0123456789').expect(400);
    });

    it('accepts the email with different case and surrounding spaces', async () => {
        await requestCode(users.anna.email).expect(202);

        await confirmReset(` ${users.anna.email.toUpperCase()} `, lastCode()).expect(200);

        await login('anna', NEW_PASSWORD).expect(200);
    });

    it('accepts only one of two concurrent resets with the same code', async () => {
        await requestCode(users.anna.email).expect(202);
        const code = lastCode();

        const [first, second] = await Promise.all([
            confirmReset(users.anna.email, code, 'firstPassword1'),
            confirmReset(users.anna.email, code, 'secondPassword2'),
        ]);

        expect([first.status, second.status].sort()).toEqual([200, 400]);
        const winner = first.status === 200 ? 'firstPassword1' : 'secondPassword2';
        await login('anna', winner).expect(200);
    });

    it('responds 422 and keeps the code valid if the new password is too short', async () => {
        await requestCode(users.anna.email).expect(202);
        const code = lastCode();

        await confirmReset(users.anna.email, code, 'short').expect(422);

        await confirmReset(users.anna.email, code).expect(200);
    });

    it('responds 422 if the code is not made of 10 digits', async () => {
        await confirmReset(users.anna.email, '12345').expect(422);
    });
});
