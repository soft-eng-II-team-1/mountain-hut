import { jest } from '@jest/globals';
import crypto from 'node:crypto';

// Prisma mock
const txMock = {
    otp_user: { deleteMany: jest.fn() },
    user: { update: jest.fn() },
};

const prismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    otp_user: { findUnique: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(),
};

jest.unstable_mockModule('../../../prisma.client.ts', () => ({ prisma: prismaMock }));

const { default: UserDAO } = await import('../../dao/UserDAO.js');
const userDao = new UserDAO();

const EMAIL = 'anna@test.it';
const OLD_PASSWORD = 'oldPassword1';
const NEW_PASSWORD = 'newPassword1';
const CODE = '0123456789';
const TEN_MINUTES = 10 * 60 * 1000;

// same derivation as UserDAO (scrypt, 64 bytes, hex)
const hashWith = (secret, salt) => crypto.scryptSync(secret, salt, 64).toString('hex');

const storedUser = (password = OLD_PASSWORD) => {
    const salt = crypto.randomBytes(16).toString('hex');
    return { user_id: 'user-1', email: EMAIL, role: 'hiker', salt, hash: hashWith(password, salt) };
};

const storedOtp = (code = CODE, expiresIn = TEN_MINUTES) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    return {
        otp_id: 'otp-1',
        user_id: 'user-1',
        salt,
        hash: hashWith(code, salt),
        created_at: new Date(now),
        expires_at: new Date(now + expiresIn),
    };
};

beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMock));
    txMock.otp_user.deleteMany.mockResolvedValue({ count: 1 });
    txMock.user.update.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.otp_user.upsert.mockResolvedValue({});
});

describe('UserDAO.changeUserPassword', () => {
    it('saves a new hash and salt when the current password is correct', async () => {
        const user = storedUser();
        prismaMock.user.findUnique.mockResolvedValue(user);

        const result = await userDao.changeUserPassword(EMAIL, OLD_PASSWORD, NEW_PASSWORD);

        expect(result).toBe(true);
        expect(txMock.user.update).toHaveBeenCalledTimes(1);
        const { where, data } = txMock.user.update.mock.calls[0][0];
        expect(where).toEqual({ email: EMAIL });
        expect(data.salt).toMatch(/^[0-9a-f]{32}$/);
        expect(data.salt).not.toBe(user.salt);
        expect(data.hash).toBe(hashWith(NEW_PASSWORD, data.salt));
        expect(data).not.toHaveProperty('password');
    });

    it('returns false and changes nothing if the current password is wrong', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());

        const result = await userDao.changeUserPassword(EMAIL, 'wrongPassword', NEW_PASSWORD);

        expect(result).toBe(false);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('returns false if the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const result = await userDao.changeUserPassword(EMAIL, OLD_PASSWORD, NEW_PASSWORD);

        expect(result).toBe(false);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('lets the user log in with the new password and not with the old one', async () => {
        let saved = storedUser();
        prismaMock.user.findUnique.mockImplementation(async () => saved);
        txMock.user.update.mockImplementation(async ({ data }) => {
            saved = { ...saved, ...data };
            return saved;
        });

        await userDao.changeUserPassword(EMAIL, OLD_PASSWORD, NEW_PASSWORD);

        expect(await userDao.getUser(EMAIL, NEW_PASSWORD)).toMatchObject({ email: EMAIL });
        expect(await userDao.getUser(EMAIL, OLD_PASSWORD)).toBe(false);
    });

    it('rethrows database errors on lookup', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('DB down'));

        await expect(userDao.changeUserPassword(EMAIL, OLD_PASSWORD, NEW_PASSWORD)).rejects.toThrow('DB down');
    });

    it('rethrows database errors on update', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());
        txMock.user.update.mockRejectedValue(new Error('DB down'));

        await expect(userDao.changeUserPassword(EMAIL, OLD_PASSWORD, NEW_PASSWORD)).rejects.toThrow('DB down');
    });

    it('deletes any outstanding recovery code in the same transaction', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());

        await userDao.changeUserPassword(EMAIL, OLD_PASSWORD, NEW_PASSWORD);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(txMock.otp_user.deleteMany).toHaveBeenCalledWith({ where: { user_id: 'user-1' } });
    });

});

describe('UserDAO.saveRecoveryCode', () => {
    it('returns false and saves nothing if the email is not registered', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const result = await userDao.saveRecoveryCode(EMAIL, CODE);

        expect(result).toBe(false);
        expect(prismaMock.otp_user.upsert).not.toHaveBeenCalled();
    });

    it('stores a salted hash of the code, never the code itself', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());

        const result = await userDao.saveRecoveryCode(EMAIL, CODE);

        expect(result).toBe(true);
        const { where, create } = prismaMock.otp_user.upsert.mock.calls[0][0];
        expect(where).toEqual({ user_id: 'user-1' });
        expect(create.user_id).toBe('user-1');
        expect(create.otp_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(create.salt).toMatch(/^[0-9a-f]{32}$/);
        expect(create.hash).toBe(hashWith(CODE, create.salt));
        expect(Object.values(create)).not.toContain(CODE);
    });

    it('makes the code expire 10 minutes after its creation', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());
        const before = Date.now();

        await userDao.saveRecoveryCode(EMAIL, CODE);

        const after = Date.now();
        const { create } = prismaMock.otp_user.upsert.mock.calls[0][0];
        expect(create.created_at.getTime()).toBeGreaterThanOrEqual(before);
        expect(create.created_at.getTime()).toBeLessThanOrEqual(after);
        expect(create.expires_at.getTime() - create.created_at.getTime()).toBe(TEN_MINUTES);
    });

    it('replaces the previous code of the same user (upsert on user_id)', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());

        await userDao.saveRecoveryCode(EMAIL, CODE);

        const { create, update } = prismaMock.otp_user.upsert.mock.calls[0][0];
        expect(update).toEqual({
            hash: create.hash,
            salt: create.salt,
            created_at: create.created_at,
            expires_at: create.expires_at,
        });
    });

    it('uses a new salt every time, even for the same code', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());

        await userDao.saveRecoveryCode(EMAIL, CODE);
        await userDao.saveRecoveryCode(EMAIL, CODE);

        const first = prismaMock.otp_user.upsert.mock.calls[0][0].create;
        const second = prismaMock.otp_user.upsert.mock.calls[1][0].create;
        expect(first.salt).not.toBe(second.salt);
        expect(first.hash).not.toBe(second.hash);
    });

    it('rethrows database errors', async () => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());
        prismaMock.otp_user.upsert.mockRejectedValue(new Error('DB down'));

        await expect(userDao.saveRecoveryCode(EMAIL, CODE)).rejects.toThrow('DB down');
    });
});

describe('UserDAO.resetPasswordWithRecoveryCode', () => {
    const setup = (otp = storedOtp()) => {
        prismaMock.user.findUnique.mockResolvedValue(storedUser());
        prismaMock.otp_user.findUnique.mockResolvedValue(otp);
        return otp;
    };

    it('changes the password and consumes the code when the code is valid', async () => {
        const otp = setup();

        const result = await userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD);

        expect(result).toBe(true);
        const { where: deleteWhere } = txMock.otp_user.deleteMany.mock.calls[0][0];
        expect(deleteWhere).toMatchObject({
            otp_id: otp.otp_id,
            user_id: 'user-1',
            hash: otp.hash,
            salt: otp.salt,
        });
        expect(deleteWhere.expires_at.gt).toBeInstanceOf(Date);

        const { where, data } = txMock.user.update.mock.calls[0][0];
        expect(where).toEqual({ user_id: 'user-1' });
        expect(data.hash).toBe(hashWith(NEW_PASSWORD, data.salt));
    });

    it('consumes the code and updates the password in the same transaction', async () => {
        setup();

        await userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.user.update).not.toHaveBeenCalled(); // only through the transaction
        expect(txMock.otp_user.deleteMany.mock.invocationCallOrder[0])
            .toBeLessThan(txMock.user.update.mock.invocationCallOrder[0]);
    });

    it('returns false if the email is not registered', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const result = await userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD);

        expect(result).toBe(false);
        expect(prismaMock.otp_user.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns false if no code was requested', async () => {
        setup(null);

        const result = await userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD);

        expect(result).toBe(false);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns false if the code is expired', async () => {
        setup(storedOtp(CODE, -1000));

        const result = await userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD);

        expect(result).toBe(false);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns false if the code is wrong', async () => {
        setup();

        const result = await userDao.resetPasswordWithRecoveryCode(EMAIL, '9999999999', NEW_PASSWORD);

        expect(result).toBe(false);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns false without throwing if the stored hash has an unexpected length', async () => {
        setup({ ...storedOtp(), hash: 'abcd' });

        await expect(userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD)).resolves.toBe(false);
    });

    it('returns false if the code was already consumed by a concurrent request', async () => {
        setup();
        txMock.otp_user.deleteMany.mockResolvedValue({ count: 0 });

        const result = await userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD);

        expect(result).toBe(false);
        expect(txMock.user.update).not.toHaveBeenCalled();
    });

    it('rethrows database errors', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('DB down'));

        await expect(userDao.resetPasswordWithRecoveryCode(EMAIL, CODE, NEW_PASSWORD)).rejects.toThrow('DB down');
    });
});
