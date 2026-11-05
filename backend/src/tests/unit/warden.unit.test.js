import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// UserDAO mock: the router creates its DAO with "new UserDAO()", which returns this object
const userDaoMock = {
    createUser: jest.fn(),
};

jest.unstable_mockModule('../../dao/UserDAO.js', () => ({
    default: function UserDAO() { return userDaoMock; },
}));

const { default: wardenRoutes } = await import('../../routes/warden.js');

// Small app with only the warden routes. The "x-test-role" header replaces the passport session,
// so the real isWarden middleware is used without logging in
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    const role = req.get('x-test-role');
    req.isAuthenticated = () => Boolean(role);
    req.user = role ? { role } : undefined;
    req.login = jest.fn(); // must never be called: the warden stays logged in as warden
    next();
});
app.use('/api/warden', wardenRoutes);
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));

const URL = '/api/warden/employees';

// Checks the 422 body by message
const expectValidationMessage = (res, message) => {
    expect(JSON.stringify(res.body)).toContain(message);
};

const validBody = () => ({
    name: 'Luca',
    surname: 'Verdi',
    email: 'luca@rifugio.it',
    password: 'employee123',
});

const employee = {
    user_id: '55555555-5555-4555-8555-555555555555',
    email: 'luca@rifugio.it',
    role: 'employee',
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('POST /api/warden/employees - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).post(URL).send(validBody()).expect(401);

        expect(userDaoMock.createUser).not.toHaveBeenCalled();
    });

    it.each(['hiker', 'employee'])('responds 403 if logged in as %s', async (role) => {
        await request(app).post(URL).set('x-test-role', role).send(validBody()).expect(403);

        expect(userDaoMock.createUser).not.toHaveBeenCalled();
    });
});

describe('POST /api/warden/employees', () => {
    it('creates an employee and responds 201', async () => {
        userDaoMock.createUser.mockResolvedValue(employee);

        const res = await request(app).post(URL).set('x-test-role', 'warden').send(validBody()).expect(201);

        expect(res.body).toEqual(employee);
        expect(userDaoMock.createUser).toHaveBeenCalledWith({
            name: 'Luca',
            surname: 'Verdi',
            email: 'luca@rifugio.it',
            phone: undefined,
            password: 'employee123',
            role: 'employee',
        });
    });

    it('always creates the user with role employee, ignoring a role in the body', async () => {
        userDaoMock.createUser.mockResolvedValue(employee);

        await request(app).post(URL).set('x-test-role', 'warden').send({ ...validBody(), role: 'warden' }).expect(201);

        expect(userDaoMock.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'employee' }));
    });

    it('trims name and surname and normalizes the email to lowercase', async () => {
        userDaoMock.createUser.mockResolvedValue(employee);

        await request(app).post(URL).set('x-test-role', 'warden')
            .send({ ...validBody(), name: '  Luca ', surname: ' Verdi  ', email: '  Luca@Rifugio.IT ' })
            .expect(201);

        expect(userDaoMock.createUser).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Luca',
            surname: 'Verdi',
            email: 'luca@rifugio.it',
        }));
    });

    it('passes the phone number when given', async () => {
        userDaoMock.createUser.mockResolvedValue(employee);

        await request(app).post(URL).set('x-test-role', 'warden').send({ ...validBody(), phone: '+39 333 1234567' }).expect(201);

        expect(userDaoMock.createUser).toHaveBeenCalledWith(expect.objectContaining({ phone: '+39 333 1234567' }));
    });

    it('does not log in as the new employee (the warden session is kept)', async () => {
        userDaoMock.createUser.mockResolvedValue(employee);
        let loginSpy;
        const spyApp = express();
        spyApp.use(express.json());
        spyApp.use((req, res, next) => {
            req.isAuthenticated = () => true;
            req.user = { role: 'warden' };
            loginSpy = req.login = jest.fn();
            next();
        });
        spyApp.use('/api/warden', wardenRoutes);

        await request(spyApp).post(URL).send(validBody()).expect(201);

        expect(loginSpy).not.toHaveBeenCalled();
    });

    it('responds 409 if the email is already registered', async () => {
        userDaoMock.createUser.mockResolvedValue(null);

        const res = await request(app).post(URL).set('x-test-role', 'warden').send(validBody()).expect(409);

        expect(res.body).toEqual({ error: 'Email already registered' });
    });

    it.each([
        ['name is missing', { name: undefined }, 'Name is required'],
        ['name is only spaces', { name: '   ' }, 'Name is required'],
        ['surname is missing', { surname: undefined }, 'Surname is required'],
        ['email is not valid', { email: 'not-an-email' }, 'A valid email is required'],
        ['phone is not valid', { phone: 'abc' }, 'Phone number is not valid'],
        ['password is shorter than 8 characters', { password: '1234567' }, 'Password must be 8-128 characters long'],
        ['password is longer than 128 characters', { password: 'x'.repeat(129) }, 'Password must be 8-128 characters long'],
        // isString() has no custom message in warden.js, so express-validator uses its default one
        ['password is not a string', { password: 12345678 }, 'Invalid value'],
    ])('responds 422 if %s', async (_, change, message) => {
        const res = await request(app).post(URL).set('x-test-role', 'warden').send({ ...validBody(), ...change }).expect(422);

        expectValidationMessage(res, message);
        expect(userDaoMock.createUser).not.toHaveBeenCalled();
    });

    it('responds 500 on unexpected errors', async () => {
        userDaoMock.createUser.mockRejectedValue(new Error('DB down'));

        await request(app).post(URL).set('x-test-role', 'warden').send(validBody()).expect(500);
    });
});