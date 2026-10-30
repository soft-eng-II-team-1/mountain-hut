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
    //returns null if user already exists, otherwise returns the created user
    this.createUser = async({name, surname, email, phone, password, role = 'hiker'}) => {
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
                    hash,
                    salt
                }
            });
            return { user_id: user.user_id, email: user.email, role: user.role };
        } catch (error) {
            if(error.code === 'P2002' && (!error.meta?.target || String(error.meta.target).includes('email'))) {
                return null;
            }
            throw error;
        }
    }
}