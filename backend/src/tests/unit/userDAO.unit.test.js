import { jest } from '@jest/globals';

// Prisma mock: must be declared BEFORE importing the DAO
const prismaMock = {
    user: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
};

jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: UserDAO } = await import('../../dao/UserDAO.js');
const userDao = new UserDAO();

const newUser = {
    name: 'Anna',
    surname: 'Bianchi',
    email: 'anna@test.it',
    password: 'password123',
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('UserDAO.createUser', () => {
    it('stores hash and salt instead of the plain password, with role hiker by default', async () => {
        prismaMock.user.create.mockImplementation(async ({ data }) => data);

        const user = await userDao.createUser(newUser);

        const { data } = prismaMock.user.create.mock.calls[0][0];
        expect(data.role).toBe('hiker');
        expect(data).not.toHaveProperty('password');
        expect(data.hash).not.toBe('password123');
        expect(data.hash).toHaveLength(128); // 64 bytes in hex
        expect(data.salt).toBeTruthy();

        expect(user).toMatchObject({ email: 'anna@test.it', role: 'hiker' });
        expect(user).not.toHaveProperty('hash');
        expect(user).not.toHaveProperty('salt');
    });

    it('uses the role passed as parameter', async () => {
        prismaMock.user.create.mockImplementation(async ({ data }) => data);

        const user = await userDao.createUser({ ...newUser, role: 'employee' });

        expect(prismaMock.user.create.mock.calls[0][0].data.role).toBe('employee');
        expect(user.role).toBe('employee');
    });

    it('generates a different salt for each user', async () => {
        prismaMock.user.create.mockImplementation(async ({ data }) => data);

        await userDao.createUser(newUser);
        await userDao.createUser({ ...newUser, email: 'other@test.it' });

        const first = prismaMock.user.create.mock.calls[0][0].data;
        const second = prismaMock.user.create.mock.calls[1][0].data;
        expect(first.salt).not.toBe(second.salt);
        expect(first.hash).not.toBe(second.hash);
    });

    it('creates a user that can then log in with the same password', async () => {
        let saved;
        prismaMock.user.create.mockImplementation(async ({ data }) => {
            saved = data;
            return data;
        });
        prismaMock.user.findUnique.mockImplementation(async () => saved);

        await userDao.createUser(newUser);
        const user = await userDao.getUser('anna@test.it', 'password123');

        expect(user).toMatchObject({ email: 'anna@test.it', role: 'hiker' });
    });

    it('returns null if the email is already registered (P2002)', async () => {
        const uniqueError = Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
            meta: { target: ['email'] },
        });
        prismaMock.user.create.mockRejectedValue(uniqueError);

        const user = await userDao.createUser(newUser);

        expect(user).toBeNull();
    });

    it('rethrows other database errors', async () => {
        prismaMock.user.create.mockRejectedValue(new Error('DB down'));

        await expect(userDao.createUser(newUser)).rejects.toThrow('DB down');
    });
});