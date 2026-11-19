import crypto from 'node:crypto';

import { prisma } from '../../prisma.client.ts'

export default function userDAO() {
    this.getUser = (email, password) => {
        return new Promise(async (resolve, reject) => {
            try {
                const user = await prisma.user.findUnique({
                    where: {
                        email: email
                    }
                });

                if (!user) {
                    return resolve(false);
                }

                crypto.scrypt(password, user.salt, 64, (err, hashedPassword) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        if (!crypto.timingSafeEqual(Buffer.from(user.hash, 'hex'), hashedPassword)) {
                            resolve(false);
                        }
                        else {
                            resolve({ user_id: user.user_id, email: user.email, role: user.role });
                        }
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    //create user function
    //default role is hiker, but can be set to employee if needed
    //first_login = true forces the user to change the password at the next login (accounts created by the staff, MH-07)
    //returns null if user already exists, otherwise returns the created user
    this.createUser = async({name, surname, email, phone, notes, emergency_contact, password, role = 'hiker', first_login = false}) => {
        const salt = crypto.randomBytes(16).toString('hex');

        const hash = await new Promise((resolve, reject) => {
            crypto.scrypt(password, salt, 64, (err, derivedKey) => {
                if (err) reject(err);
                resolve(derivedKey.toString('hex'));
            });
        });

        try {
            const user = await prisma.user.create({
                data: {
                    user_id: crypto.randomUUID(),
                    role,
                    name,
                    surname,
                    email,
                    phone: phone || null,
                    notes: notes || null,
                    emergency_contact: emergency_contact || null,
                    hash,
                    salt,
                    first_login
                }
            });
            return { user_id: user.user_id, email: user.email, role: user.role };
        } catch (error) {
            if (error.code === 'P2002' && (!error.meta?.target || String(error.meta.target).includes('email'))) {
                return null;
            }
            throw error;
        }
    }

    this.changeUserPassword = async (email, currentPassword, newPassword) => {
        try {
            const user = await this.getUser(email, currentPassword);

            if (!user) {
                return false;
            }

            const salt = crypto.randomBytes(16).toString('hex');

            const hash = await new Promise((resolve, reject) => {
                crypto.scrypt(newPassword, salt, 64, (err, derivedKey) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(derivedKey.toString('hex'));
                });
            });

            await prisma.user.update({
                where: {
                    email: email
                },
                data: {
                    hash,
                    salt
                }
            });

            return true;
        } catch (error) {
            throw error;
        }
    }

    this.saveRecoveryCode = async (email, recoveryCode) => {
        try {
            const user = await prisma.user.findUnique({
                where: {
                    email: email
                }
            });

            if (!user) {
                return false;
            }

            const salt = crypto.randomBytes(16).toString('hex');

            const hash = await new Promise((resolve, reject) => {
                crypto.scrypt(recoveryCode, salt, 64, (err, derivedKey) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(derivedKey.toString('hex'));
                });
            });

            const now = new Date();
            const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

            await prisma.otp_user.upsert({
                where: { user_id: user.user_id },
                create: {
                    otp_id: crypto.randomUUID(),
                    user_id: user.user_id,
                    hash,
                    salt,
                    created_at: now,
                    expires_at: tenMinutesFromNow
                },
                update: {
                    hash,
                    salt,
                    created_at: now,
                    expires_at: tenMinutesFromNow
                }
            });

            return true;
        } catch (error) {
            throw error;
        }
    }

    this.resetPasswordWithRecoveryCode = async (email, recoveryCode, newPassword) => {
        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (!user) {
            return false;
        }

        const recoveryCredential = await prisma.otp_user.findUnique({
            where: {
                user_id: user.user_id
            }
        });
        const now = new Date();

        if (!recoveryCredential || recoveryCredential.expires_at <= now) {
            return false;
        }

        const recoveryCodeHash = await new Promise((resolve, reject) => {
            crypto.scrypt(recoveryCode, recoveryCredential.salt, 64, (err, derivedKey) => {
                if (err) {
                    return reject(err);
                }
                resolve(derivedKey);
            });
        });
        const storedRecoveryCodeHash = Buffer.from(recoveryCredential.hash, 'hex');

        if (storedRecoveryCodeHash.length != recoveryCodeHash.length || !crypto.timingSafeEqual(storedRecoveryCodeHash, recoveryCodeHash)) {
            return false;
        }

        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHash = await new Promise((resolve, reject) => {
            crypto.scrypt(newPassword, newSalt, 64, (err, derivedKey) => {
                if (err) {
                    return reject(err);
                }
                resolve(derivedKey.toString('hex'));
            });
        });

        return prisma.$transaction(async (transaction) => {
            const consumedCredential = await transaction.otp_user.deleteMany({
                where: {
                    otp_id: recoveryCredential.otp_id,
                    user_id: user.user_id,
                    hash: recoveryCredential.hash,
                    salt: recoveryCredential.salt,
                    expires_at: { gt: new Date() }
                }
            });

            if (consumedCredential.count != 1) {
                return false;
            }

            await transaction.user.update({
                where: {
                    user_id: user.user_id
                },
                data: {
                    hash: newHash,
                    salt: newSalt
                }
            });

            return true;
        });
    }
}