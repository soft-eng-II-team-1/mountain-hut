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
}