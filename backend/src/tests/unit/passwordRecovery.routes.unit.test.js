import { jest } from '@jest/globals';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';

const userDaoMock = {
    changeUserPassword: jest.fn(),
    saveRecoveryCode: jest.fn(),
    resetPasswordWithRecoveryCode: jest.fn(),
};
const sendRecoveryCodeEmail = jest.fn();

jest.unstable_mockModule('../../dao/UserDAO.js', () => ({
    default: function UserDAO() { return userDaoMock; },
}));
jest.unstable_mockModule('../../services/passwordRecovery.js', () => ({ sendRecoveryCodeEmail }));

const { default: authRoutes } = await import('../../routes/auth.js');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    req.isAuthenticated = () => req.get('x-authenticated') === 'true';
    req.user = { user_id: 'test-user', email: 'current@example.com', role: 'hiker' };
    req.login = (user, callback) => {
        req.user = user;
        callback();
    };
    next();
});
app.use('/api/auth', authRoutes);
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));

const passwordUrl = '/api/auth/password';
const resetRequestUrl = '/api/auth/password-reset/request';
const resetConfirmUrl = '/api/auth/password-reset/confirm';
const GENERIC_MESSAGE = 'If an account exists for this email, recovery instructions will be sent';

const validChange = () => ({ oldPassword: 'oldPassword1', newPassword: 'newPassword1' });
const validConfirm = () => ({ email: 'anna@test.it', recoveryCode: '0123456789', newPassword: 'newPassword1' });

const changePassword = (body) => request(app).put(passwordUrl).set('x-authenticated', 'true').send(body);

const expectValidationMessage = (res, message) => {
    expect(JSON.stringify(res.body)).toContain(message);
};

beforeEach(() => {
    jest.resetAllMocks();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('PUT /api/auth/password', () => {
    it('responds 401 and does not touch the password if nobody is logged in', async () => {
        await request(app).put(passwordUrl).send(validChange()).expect(401);

        expect(userDaoMock.changeUserPassword).not.toHaveBeenCalled();
    });

    it('checks the session before validating the body', async () => {
        await request(app).put(passwordUrl).send({}).expect(401);
    });

    it('changes the password of the logged in user', async () => {
        userDaoMock.changeUserPassword.mockResolvedValue(true);

        await changePassword(validChange()).expect(200);

        expect(userDaoMock.changeUserPassword)
            .toHaveBeenCalledWith('current@example.com', 'oldPassword1', 'newPassword1');
    });

    it('uses the email of the session, not one sent in the body', async () => {
        userDaoMock.changeUserPassword.mockResolvedValue(true);

        await changePassword({ ...validChange(), email: 'victim@example.com' }).expect(200);

        expect(userDaoMock.changeUserPassword.mock.calls[0][0]).toBe('current@example.com');
    });

    it('responds 401 if the current password is wrong', async () => {
        userDaoMock.changeUserPassword.mockResolvedValue(false);

        const res = await changePassword(validChange()).expect(401);

        expect(res.body).toEqual({
            error: 'Old credentials are incorrect',
            code: 'INVALID_OLD_PASSWORD',
        });
    });

    it.each([
        ['8 characters', 'a'.repeat(8)],
        ['128 characters', 'a'.repeat(128)],
    ])('accepts a new password of %s', async (_, newPassword) => {
        userDaoMock.changeUserPassword.mockResolvedValue(true);

        await changePassword({ ...validChange(), newPassword }).expect(200);
    });

    it.each([
        ['missing old password', { oldPassword: undefined }, 'Old password is required'],
        ['empty old password', { oldPassword: '' }, 'Old password is required'],
        ['non-string old password', { oldPassword: 12345678 }, 'Invalid value'],
        ['missing new password', { newPassword: undefined }, 'New password must be 8-128 characters long'],
        ['new password of 7 characters', { newPassword: 'a'.repeat(7) }, 'New password must be 8-128 characters long'],
        ['new password of 129 characters', { newPassword: 'a'.repeat(129) }, 'New password must be 8-128 characters long'],
        ['non-string new password', { newPassword: 123456789 }, 'Invalid value'],
    ])('responds 422 for %s', async (_, override, message) => {
        const res = await changePassword({ ...validChange(), ...override }).expect(422);

        expectValidationMessage(res, message);
        expect(userDaoMock.changeUserPassword).not.toHaveBeenCalled();
    });

    it('responds 500 if the database fails', async () => {
        userDaoMock.changeUserPassword.mockRejectedValue(new Error('DB down'));

        await changePassword(validChange()).expect(500);
    });
});

describe('POST /api/auth/password-reset/request', () => {
    it('saves a 10-digit code and emails the same code to the user', async () => {
        userDaoMock.saveRecoveryCode.mockResolvedValue(true);
        sendRecoveryCodeEmail.mockResolvedValue({});

        const res = await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(202);

        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
        const [email, code] = userDaoMock.saveRecoveryCode.mock.calls[0];
        expect(email).toBe('anna@test.it');
        expect(code).toMatch(/^\d{10}$/);
        expect(sendRecoveryCodeEmail).toHaveBeenCalledWith('anna@test.it', code);
    });

    it('generates the code with the cryptographic RNG over the whole 10-digit range', async () => {
        const randomInt = jest.spyOn(crypto, 'randomInt');
        userDaoMock.saveRecoveryCode.mockResolvedValue(true);

        await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(202);

        expect(randomInt).toHaveBeenCalledWith(0, 10 ** 10);
    });

    it('pads small random numbers with leading zeros', async () => {
        jest.spyOn(crypto, 'randomInt').mockReturnValue(42);
        userDaoMock.saveRecoveryCode.mockResolvedValue(true);

        await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(202);

        expect(userDaoMock.saveRecoveryCode).toHaveBeenCalledWith('anna@test.it', '0000000042');
    });

    it('generates a different code for each request', async () => {
        userDaoMock.saveRecoveryCode.mockResolvedValue(true);

        await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(202);
        await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(202);

        const [first, second] = userDaoMock.saveRecoveryCode.mock.calls.map(([, code]) => code);
        expect(first).not.toBe(second);
    });

    it('responds with the same 202 if the email is not registered, without sending emails', async () => {
        userDaoMock.saveRecoveryCode.mockResolvedValue(false);

        const res = await request(app).post(resetRequestUrl).send({ email: 'nobody@test.it' }).expect(202);

        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
        expect(sendRecoveryCodeEmail).not.toHaveBeenCalled();
    });

    it('still responds 202 if the email cannot be delivered', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        userDaoMock.saveRecoveryCode.mockResolvedValue(true);
        sendRecoveryCodeEmail.mockRejectedValue(new Error('SMTP down'));

        const res = await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(202);

        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
        expect(consoleError).toHaveBeenCalled();
    });

    it('trims and lowercases the email', async () => {
        userDaoMock.saveRecoveryCode.mockResolvedValue(true);

        await request(app).post(resetRequestUrl).send({ email: '  Anna@Test.IT ' }).expect(202);

        expect(userDaoMock.saveRecoveryCode.mock.calls[0][0]).toBe('anna@test.it');
    });

    it.each([
        ['missing email', {}],
        ['invalid email', { email: 'not-an-email' }],
    ])('responds 422 for %s', async (_, body) => {
        const res = await request(app).post(resetRequestUrl).send(body).expect(422);

        expectValidationMessage(res, 'A valid email is required');
        expect(userDaoMock.saveRecoveryCode).not.toHaveBeenCalled();
    });

    it('responds 500 and sends nothing if the database fails', async () => {
        userDaoMock.saveRecoveryCode.mockRejectedValue(new Error('DB down'));

        await request(app).post(resetRequestUrl).send({ email: 'anna@test.it' }).expect(500);

        expect(sendRecoveryCodeEmail).not.toHaveBeenCalled();
    });
});

describe('POST /api/auth/password-reset/confirm', () => {
    it('resets the password when the code is valid, without being logged in', async () => {
        userDaoMock.resetPasswordWithRecoveryCode.mockResolvedValue(true);

        await request(app).post(resetConfirmUrl).send(validConfirm()).expect(200);

        expect(userDaoMock.resetPasswordWithRecoveryCode)
            .toHaveBeenCalledWith('anna@test.it', '0123456789', 'newPassword1');
    });

    it('trims and lowercases the email', async () => {
        userDaoMock.resetPasswordWithRecoveryCode.mockResolvedValue(true);

        await request(app).post(resetConfirmUrl).send({ ...validConfirm(), email: ' Anna@Test.IT ' }).expect(200);

        expect(userDaoMock.resetPasswordWithRecoveryCode.mock.calls[0][0]).toBe('anna@test.it');
    });

    it('responds 400 if the code is wrong, expired or already used', async () => {
        userDaoMock.resetPasswordWithRecoveryCode.mockResolvedValue(false);

        const res = await request(app).post(resetConfirmUrl).send(validConfirm()).expect(400);

        expect(res.body).toEqual({ error: 'Password recovery not confirmed' });
    });

    it.each([
        ['invalid email', { email: 'not-an-email' }, 'A valid email is required'],
        ['missing code', { recoveryCode: undefined }, 'Recovery code must be a string'],
        ['numeric code', { recoveryCode: 1234567890 }, 'Recovery code must be a string'],
        ['code of 9 digits', { recoveryCode: '012345678' }, 'Recovery code must contain exactly 10 digits'],
        ['code of 11 digits', { recoveryCode: '01234567890' }, 'Recovery code must contain exactly 10 digits'],
        ['code with letters', { recoveryCode: '01234abcde' }, 'Recovery code must contain exactly 10 digits'],
        ['code with spaces', { recoveryCode: '01234 6789' }, 'Recovery code must contain exactly 10 digits'],
        ['new password of 7 characters', { newPassword: 'a'.repeat(7) }, 'New password must be 8-128 characters long'],
        ['new password of 129 characters', { newPassword: 'a'.repeat(129) }, 'New password must be 8-128 characters long'],
    ])('responds 422 for %s', async (_, override, message) => {
        const res = await request(app).post(resetConfirmUrl).send({ ...validConfirm(), ...override }).expect(422);

        expectValidationMessage(res, message);
        expect(userDaoMock.resetPasswordWithRecoveryCode).not.toHaveBeenCalled();
    });

    it('responds 500 if the database fails', async () => {
        userDaoMock.resetPasswordWithRecoveryCode.mockRejectedValue(new Error('DB down'));

        await request(app).post(resetConfirmUrl).send(validConfirm()).expect(500);
    });
});
