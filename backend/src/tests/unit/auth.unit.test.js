import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const userDaoMock = {
    createUser: jest.fn(),
};

let authenticateError;
let authenticatedUser;
let authenticationInfo;
let authenticationRequestBody;

const passportMock = {
    authenticate: jest.fn((strategy, callback) => (req, res, next) => {
        authenticationRequestBody = req.body;
        return callback(authenticateError, authenticatedUser, authenticationInfo)(req, res, next);
    }),
};

jest.unstable_mockModule('../../dao/UserDAO.js', () => ({
    default: function UserDAO() { return userDaoMock; },
}));

jest.unstable_mockModule('passport', () => ({
    default: passportMock,
}));

const { default: authRoutes } = await import('../../routes/auth.js');

let loginError;
let logoutError;

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    req.isAuthenticated = () => req.get('x-authenticated') === 'true';
    req.user = { user_id: 'test-user', email: 'current@example.com' };
    req.login = (user, callback) => {
        if (!loginError) {
            req.user = user;
        }
        callback(loginError);
    };
    req.logout = (callback) => callback(logoutError);
    next();
});
app.use('/api/auth', authRoutes);
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));

const signupUrl = '/api/auth/signup';
const loginUrl = '/api/auth/login';
const logoutUrl = '/api/auth/logout';
const userUrl = '/api/auth/user';

const validSignupBody = () => ({
    name: 'Luca',
    surname: 'Verdi',
    email: 'luca@example.com',
    password: 'password123',
});

const validLoginBody = () => ({
    email: 'luca@example.com',
    password: 'password123',
});

const expectValidationMessage = (res, message) => {
    expect(JSON.stringify(res.body)).toContain(message);
};

beforeEach(() => {
    jest.resetAllMocks();
    authenticateError = null;
    authenticatedUser = null;
    authenticationInfo = null;
    authenticationRequestBody = null;
    loginError = null;
    logoutError = null;
    passportMock.authenticate.mockImplementation((strategy, callback) => (req, res, next) => {
        authenticationRequestBody = req.body;
        return callback(authenticateError, authenticatedUser, authenticationInfo)(req, res, next);
    });
});

describe('POST /api/auth/signup', () => {
    it('creates an account and opens a session', async () => {
        const user = { user_id: 'new-user', email: 'luca@example.com', role: 'hiker' };
        userDaoMock.createUser.mockResolvedValue(user);

        const res = await request(app).post(signupUrl).send(validSignupBody()).expect(201);

        expect(res.body).toEqual(user);
        expect(userDaoMock.createUser).toHaveBeenCalledWith({
            name: 'Luca',
            surname: 'Verdi',
            email: 'luca@example.com',
            phone: undefined,
            password: 'password123',
        });
    });

    it('trims names and normalizes the email before creating the account', async () => {
        userDaoMock.createUser.mockResolvedValue({ user_id: 'new-user' });

        await request(app).post(signupUrl).send({
            ...validSignupBody(),
            name: '  Luca ',
            surname: ' Verdi  ',
            email: '  Luca@Example.COM ',
        }).expect(201);

        expect(userDaoMock.createUser).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Luca',
            surname: 'Verdi',
            email: 'luca@example.com',
        }));
    });

    it('returns 409 when the email is already registered', async () => {
        userDaoMock.createUser.mockResolvedValue(null);

        const res = await request(app).post(signupUrl).send(validSignupBody()).expect(409);

        expect(res.body).toEqual({ error: 'Email already registered' });
    });

    it.each([
        ['missing name', { name: undefined }, 'Name is required'],
        ['blank name', { name: '   ' }, 'Name is required'],
        ['name exceeding 50 characters', { name: 'n'.repeat(51) }, 'Name is too long'],
        ['missing surname', { surname: undefined }, 'Surname is required'],
        ['surname exceeding 50 characters', { surname: 's'.repeat(51) }, 'Surname is too long'],
        ['invalid email', { email: 'not-an-email' }, 'A valid email is required'],
        ['invalid phone', { phone: 'abc' }, 'Phone number is not valid'],
        ['password shorter than 8 characters', { password: 'short' }, 'Password must be 8-128 characters long'],
        ['password longer than 128 characters', { password: 'p'.repeat(129) }, 'Password must be 8-128 characters long'],
        ['non-string password', { password: 12345678 }, 'Invalid value'],
    ])('returns 422 for %s', async (_, change, message) => {
        const res = await request(app).post(signupUrl).send({ ...validSignupBody(), ...change }).expect(422);

        expectValidationMessage(res, message);
        expect(userDaoMock.createUser).not.toHaveBeenCalled();
    });

    it('accepts a missing phone number', async () => {
        userDaoMock.createUser.mockResolvedValue({ user_id: 'new-user' });

        await request(app).post(signupUrl).send(validSignupBody()).expect(201);

        expect(userDaoMock.createUser).toHaveBeenCalledWith(expect.objectContaining({ phone: undefined }));
    });

    it('passes DAO errors to the error handler', async () => {
        userDaoMock.createUser.mockRejectedValue(new Error('database unavailable'));

        await request(app).post(signupUrl).send(validSignupBody()).expect(500);
    });

    it('passes session login errors to the error handler', async () => {
        userDaoMock.createUser.mockResolvedValue({ user_id: 'new-user' });
        loginError = new Error('session unavailable');

        await request(app).post(signupUrl).send(validSignupBody()).expect(500);
    });
});

describe('POST /api/auth/login', () => {
    it('authenticates the user and opens a session', async () => {
        const user = { user_id: 'user-id', email: 'luca@example.com' };
        authenticatedUser = user;

        const res = await request(app).post(loginUrl).send(validLoginBody()).expect(200);

        expect(res.body).toEqual(user);
        expect(passportMock.authenticate).toHaveBeenCalledWith('local', expect.any(Function));
    });

    it('normalizes the email before authentication', async () => {
        await request(app).post(loginUrl).send({ ...validLoginBody(), email: '  Luca@Example.COM ' }).expect(401);

        expect(authenticationRequestBody.email).toBe('luca@example.com');
        expect(passportMock.authenticate).toHaveBeenCalledWith('local', expect.any(Function));
    });

    it.each([
        ['missing email', { email: undefined }, 'A valid email is required'],
        ['invalid email', { email: 'invalid' }, 'A valid email is required'],
        ['missing password', { password: undefined }, 'Password is required'],
        ['empty password', { password: '' }, 'Password is required'],
        ['non-string password', { password: 123 }, 'Invalid value'],
    ])('returns 422 for %s', async (_, change, message) => {
        const res = await request(app).post(loginUrl).send({ ...validLoginBody(), ...change }).expect(422);

        expectValidationMessage(res, message);
        expect(passportMock.authenticate).not.toHaveBeenCalled();
    });

    it('returns the authentication message when credentials are rejected', async () => {
        authenticationInfo = { message: 'Incorrect password' };

        const res = await request(app).post(loginUrl).send(validLoginBody()).expect(401);

        expect(res.body).toEqual({ error: 'Incorrect password' });
    });

    it('returns a fallback message when credentials are rejected without details', async () => {
        const res = await request(app).post(loginUrl).send(validLoginBody()).expect(401);

        expect(res.body).toEqual({ error: 'Email or password is incorrect' });
    });

    it('passes Passport errors to the error handler', async () => {
        authenticateError = new Error('authentication failed');

        await request(app).post(loginUrl).send(validLoginBody()).expect(500);
    });

    it('passes session login errors to the error handler', async () => {
        authenticatedUser = { user_id: 'user-id' };
        loginError = new Error('session unavailable');

        await request(app).post(loginUrl).send(validLoginBody()).expect(500);
    });
});

describe('POST /api/auth/logout', () => {
    it('logs out and responds with an empty 200 response', async () => {
        await request(app).post(logoutUrl).expect(200).expect('');
    });

    it('passes logout errors to the error handler', async () => {
        logoutError = new Error('logout failed');

        await request(app).post(logoutUrl).expect(500);
    });
});

describe('GET /api/auth/user', () => {
    it('returns the authenticated user', async () => {
        const user = { user_id: 'test-user', email: 'current@example.com' };

        const res = await request(app).get(userUrl).set('x-authenticated', 'true').expect(200);

        expect(res.body).toEqual(user);
    });

    it('returns 401 when the user is not authenticated', async () => {
        const res = await request(app).get(userUrl).expect(401);

        expect(res.body).toEqual({ message: 'Unauthorized (user is not logged in)' });
    });
});
