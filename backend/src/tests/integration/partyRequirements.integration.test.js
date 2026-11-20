// MH-05 - Party requirements: integration tests of the requirements list, saved when booking
// (POST /api/slots/:slotId/reservations) and replaced when changing the booking (PUT /api/reservations/:reservationId).
// Everything is real (routes, DAO, database) except the SMTP server: the emails end up in sendMail.mock.calls
import { jest } from '@jest/globals';
import crypto from 'node:crypto';

const sendMail = jest.fn();
const nodemailerMock = {
    createTransport: jest.fn(() => ({ sendMail })),
    createTestAccount: jest.fn(async () => ({ user: 'test-user', pass: 'test-pass' })),
    getTestMessageUrl: jest.fn(() => false),
};
jest.unstable_mockModule('nodemailer', () => ({ default: nodemailerMock }));

// Must be imported AFTER the mock
const { default: request } = await import('supertest');
const { default: app } = await import('../../app.js');
const { prisma } = await import('../../../prisma.client.ts');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const stamp = Date.now();
const PASSWORD = 'password123';

// All the test data has unique names/ids, so it does not clash with the seed and is removed at the end
const users = {};
const tableIds = {};
const slotIds = {};

const createUser = async (key, role) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex'); // same as UserDAO
    users[key] = await prisma.user.create({
        data: {
            user_id: crypto.randomUUID(), role, name: 'Test', surname: key,
            email: `${key}.${stamp}@test.it`.toLowerCase(), hash, salt,
        },
    });
};

const createTable = async (key, seats) => {
    const table = await prisma.table.create({
        data: { table_id: crypto.randomUUID(), number: `MH05-${stamp}-${key}`, seats },
    });
    tableIds[key] = table.table_id;
};

const createSlot = async (key, startsIn, tableKeys) => {
    const start = new Date(Date.now() + startsIn);
    const slot = await prisma.slot.create({
        data: { slot_id: crypto.randomUUID(), date_time_start: start, date_time_end: new Date(start.getTime() + HOUR) },
    });
    for (const tableKey of tableKeys) {
        await prisma.slot_table.create({
            data: { id: crypto.randomUUID(), slot_id: slot.slot_id, table_id: tableIds[tableKey] },
        });
    }
    slotIds[key] = slot.slot_id;
};

// Returns an agent that keeps the session cookie of the given user
const loginAs = async (key) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: users[key].email, password: PASSWORD }).expect(200);
    return agent;
};

const book = (agent, slotKey, people, requirements) =>
    agent.post(`/api/slots/${slotIds[slotKey]}/reservations`).send({ people, requirements });

const change = (agent, reservationId, slotKey, people, requirements) =>
    agent.put(`/api/reservations/${reservationId}`).send({ slot_id: slotIds[slotKey], people, requirements });

// Reservation as saved in the DB, with its requirements
const findSaved = (reservationId) => prisma.reservation.findUnique({
    where: { reservation_id: reservationId },
    include: { reservation_requirement: { select: { allergies: true, description: true } } },
});

// Requirements saved in the DB for the reservations of a hiker
const requirementsOf = (key) => prisma.reservation_requirement.count({ where: { reservation: { user_id: users[key].user_id } } });

// Same content, whatever the order
const sorted = (list) => [...list].sort((a, b) => a.description.localeCompare(b.description));

const removeTestReservations = async () => {
    const ids = Object.values(slotIds);
    await prisma.reservation_table.deleteMany({ where: { reservation: { slot_id: { in: ids } } } });
    // the requirements are removed with their reservation (ON DELETE CASCADE)
    await prisma.reservation.deleteMany({ where: { slot_id: { in: ids } } });
};

// Example of the user story: three requirements for subsets of the party
const STORY_EXAMPLE = [
    { allergies: true, description: '1 vegan, peanut allergy' },
    { allergies: true, description: '1 shellfish allergy' },
    { allergies: false, description: '2 vegetarians' },
];

let anna;

beforeAll(async () => {
    await createUser('anna', 'hiker');

    await createTable('A', 6);
    await createTable('B', 2);

    await createSlot('main', 5 * DAY, ['A']);   // 6 seats
    await createSlot('small', 5 * DAY, ['B']);  // 2 seats

    anna = await loginAs('anna');
});

// Every test starts with empty slots and no emails
beforeEach(async () => {
    await removeTestReservations();
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: 'test-message-id' });
});

afterAll(async () => {
    await removeTestReservations();
    const ids = Object.values(slotIds);
    await prisma.slot_table.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.slot.deleteMany({ where: { slot_id: { in: ids } } });
    await prisma.table.deleteMany({ where: { table_id: { in: Object.values(tableIds) } } });
    await prisma.user.deleteMany({ where: { user_id: { in: Object.values(users).map((u) => u.user_id) } } });
    await prisma.$disconnect();
});

describe('Booking with a list of party requirements', () => {
    it('saves every requirement with its own allergies flag (user story example)', async () => {
        const res = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        expect(res.body.requirements).toEqual(STORY_EXAMPLE);
        const saved = await findSaved(res.body.reservation_id);
        expect(saved.has_allergies).toBe(true);
        expect(sorted(saved.reservation_requirement)).toEqual(sorted(STORY_EXAMPLE));
    });

    it('returns the requirements with the allergies first in the reservation details', async () => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        const res = await anna.get(`/api/reservations/${body.reservation_id}`).expect(200);

        expect(res.body.has_allergies).toBe(true);
        expect(res.body.requirements).toEqual([
            { allergies: true, description: '1 shellfish allergy' },
            { allergies: true, description: '1 vegan, peanut allergy' },
            { allergies: false, description: '2 vegetarians' },
        ]);
    });

    it('lists the requirements and marks the allergies in the confirmation email', async () => {
        await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        expect(sendMail).toHaveBeenCalledTimes(1);
        const [{ text }] = sendMail.mock.calls[0];
        expect(text).toContain('Requirements: ALLERGY: 1 shellfish allergy; ALLERGY: 1 vegan, peanut allergy; 2 vegetarians');
    });

    it('does not set has_allergies when no requirement has allergies', async () => {
        const { body } = await book(anna, 'main', 2, [{ allergies: false, description: '2 vegetarians' }]).expect(201);

        const saved = await findSaved(body.reservation_id);
        expect(saved.has_allergies).toBe(false);
        expect(saved.reservation_requirement).toEqual([{ allergies: false, description: '2 vegetarians' }]);
    });

    it('responds 422 and saves nothing if there are more requirements than people', async () => {
        const res = await book(anna, 'main', 2, STORY_EXAMPLE).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        expect(await prisma.reservation.count({ where: { user_id: users.anna.user_id } })).toBe(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('responds 422 and saves nothing if a requirement has no allergies flag', async () => {
        await book(anna, 'main', 4, [STORY_EXAMPLE[0], { description: '1 shellfish allergy' }]).expect(422);

        expect(await prisma.reservation.count({ where: { user_id: users.anna.user_id } })).toBe(0);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('saves no requirements when the booking fails (not enough seats)', async () => {
        await book(anna, 'small', 3, STORY_EXAMPLE).expect(400);

        expect(await prisma.reservation.count({ where: { user_id: users.anna.user_id } })).toBe(0);
        expect(await requirementsOf('anna')).toBe(0);
    });

    it('removes the requirements together with their reservation', async () => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        await prisma.reservation_table.deleteMany({ where: { reservation_id: body.reservation_id } });
        await prisma.reservation.delete({ where: { reservation_id: body.reservation_id } });

        expect(await requirementsOf('anna')).toBe(0);
    });
});

describe('Changing the party requirements of a booking', () => {
    it('replaces the whole list and recalculates has_allergies', async () => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);
        sendMail.mockClear();
        const vegetarians = [{ allergies: false, description: '2 vegetarians' }];

        const res = await change(anna, body.reservation_id, 'main', 4, vegetarians).expect(200);

        expect(res.body).toMatchObject({ requirements: vegetarians, has_allergies: false, changed: true, confirmation_sent: true });
        const saved = await findSaved(body.reservation_id);
        expect(saved.has_allergies).toBe(false);
        expect(saved.reservation_requirement).toEqual(vegetarians);
        expect(sendMail.mock.calls[0][0].text).toContain('Requirements: 2 vegetarians');
    });

    it('sets has_allergies when a requirement with allergies is added', async () => {
        const { body } = await book(anna, 'main', 4, null).expect(201);

        await change(anna, body.reservation_id, 'main', 4, [{ allergies: true, description: '1 shellfish allergy' }]).expect(200);

        expect((await findSaved(body.reservation_id)).has_allergies).toBe(true);
    });

    it.each([
        ['null', null],
        ['an empty list', []],
    ])('removes all the requirements when they are %s', async (_, requirements) => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        await change(anna, body.reservation_id, 'main', 4, requirements).expect(200);

        const saved = await findSaved(body.reservation_id);
        expect(saved.reservation_requirement).toEqual([]);
        expect(saved.has_allergies).toBe(false);
    });

    it('changes nothing and sends no email if the same requirements are sent in another order', async () => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);
        sendMail.mockClear();

        const res = await change(anna, body.reservation_id, 'main', 4, [...STORY_EXAMPLE].reverse()).expect(200);

        expect(res.body.changed).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();
        expect(await requirementsOf('anna')).toBe(STORY_EXAMPLE.length);
    });

    it('responds 422 and keeps the requirements if they are more than the new party size', async () => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        const res = await change(anna, body.reservation_id, 'main', 2, STORY_EXAMPLE).expect(422);

        expect(res.body.errors.map((e) => e.field)).toEqual(['requirements']);
        const saved = await findSaved(body.reservation_id);
        expect(saved.people).toBe(4);
        expect(sorted(saved.reservation_requirement)).toEqual(sorted(STORY_EXAMPLE));
    });

    it('keeps the requirements when only the party size changes', async () => {
        const { body } = await book(anna, 'main', 4, STORY_EXAMPLE).expect(201);

        await change(anna, body.reservation_id, 'main', 5, STORY_EXAMPLE).expect(200);

        const saved = await findSaved(body.reservation_id);
        expect(saved.people).toBe(5);
        expect(saved.has_allergies).toBe(true);
        expect(sorted(saved.reservation_requirement)).toEqual(sorted(STORY_EXAMPLE));
    });
});
