import crypto from 'node:crypto';

import { prisma } from '../../prisma.client.ts'

// MH-07: maximum number of hikers returned by a search (the employee should refine the search beyond this)
const MAX_HIKER_SEARCH_RESULTS = 20;

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
    this.createUser = async({name, surname, email, phone, notes, emergency_contact, password, role = 'hiker'}) => {
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

    //MH-07: search the hikers already registered, so that an employee can reserve on their behalf
    //the given criteria (at least one, checked by the route) are combined in AND:
    // - email: exact match, case-insensitive (email is unique, so at most one hiker)
    // - name: every word must be contained in the name or in the surname ("Mario Rossi", "rossi mario", "ross")
    // - phone: partial match on the number without spaces ("333 123" matches "+39 3331234567")
    //returns the hikers ordered by surname and name, at most MAX_HIKER_SEARCH_RESULTS
    this.searchHikers = async ({ email, name, phone }) => {
        const conditions = [{ role: 'hiker' }];

        if (email) {
            conditions.push({ email: { equals: email, mode: 'insensitive' } });
        }

        if (name) {
            const words = name.split(/\s+/).filter(Boolean);
            for (const word of words) {
                conditions.push({
                    OR: [
                        { name: { contains: word, mode: 'insensitive' } },
                        { surname: { contains: word, mode: 'insensitive' } },
                    ]
                });
            }
        }

        if (phone) {
            //phone numbers can be saved with spaces: they are ignored on both sides
            //the route allows only digits and '+', so the pattern contains no LIKE wildcards
            const pattern = `%${phone.replace(/\s+/g, '')}%`;
            const rows = await prisma.$queryRaw`
                SELECT user_id FROM "user"
                WHERE role = 'hiker' AND REPLACE(phone, ' ', '') LIKE ${pattern}`;
            conditions.push({ user_id: { in: rows.map((row) => row.user_id) } });
        }

        return prisma.user.findMany({
            where: { AND: conditions },
            select: { user_id: true, name: true, surname: true, email: true, phone: true },
            orderBy: [{ surname: 'asc' }, { name: 'asc' }],
            take: MAX_HIKER_SEARCH_RESULTS,
        });
    }
}