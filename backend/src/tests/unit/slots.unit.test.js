import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// SlotDAO mock: the router creates its DAO with "new SlotDAO()", which returns this object
const slotDaoMock = {
    getSlots: jest.fn(),
    getSlotById: jest.fn(),
    createSlot: jest.fn(),
    updateSlot: jest.fn(),
    deleteSlot: jest.fn(),
};

class SlotError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

jest.unstable_mockModule('../../dao/SlotDAO.js', () => ({
    default: function SlotDAO() { return slotDaoMock; },
    SlotError,
}));

const { default: slotRoutes } = await import('../../routes/slots.js');

// Small app with only the slot routes. The "x-test-role" header replaces the passport session,
// so the real isStaff middleware is used without logging in
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    const role = req.get('x-test-role');
    req.isAuthenticated = () => Boolean(role);
    req.user = role ? { role } : undefined;
    next();
});
app.use('/api/slots', slotRoutes);
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));

const HOUR = 60 * 60 * 1000;
const SLOT_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';

// Valid body: a one hour slot starting tomorrow, with one table
const validBody = () => ({
    date_time_start: new Date(Date.now() + 24 * HOUR).toISOString(),
    date_time_end: new Date(Date.now() + 25 * HOUR).toISOString(),
    table_ids: [TABLE_ID],
});

const slot = {
    slot_id: SLOT_ID,
    date_time_start: '2030-07-01T12:00:00.000Z',
    date_time_end: '2030-07-01T13:00:00.000Z',
    tables: [{ table_id: TABLE_ID, number: 'T1', seats: 4 }],
    total_seats: 4,
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('Slot routes - authorization', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).get('/api/slots').expect(401);

        expect(slotDaoMock.getSlots).not.toHaveBeenCalled();
    });

    it('responds 403 if logged in as hiker', async () => {
        await request(app).post('/api/slots').set('x-test-role', 'hiker').send(validBody()).expect(403);

        expect(slotDaoMock.createSlot).not.toHaveBeenCalled();
    });

    it('lets the warden manage the slots too', async () => {
        slotDaoMock.getSlots.mockResolvedValue([]);

        await request(app).get('/api/slots').set('x-test-role', 'warden').expect(200);
    });
});

describe('GET /api/slots', () => {
    it('returns the list of slots', async () => {
        slotDaoMock.getSlots.mockResolvedValue([slot]);

        const res = await request(app).get('/api/slots').set('x-test-role', 'employee').expect(200);

        expect(res.body).toEqual([slot]);
    });

    it('passes the "from" and "to" filters as dates', async () => {
        slotDaoMock.getSlots.mockResolvedValue([]);

        await request(app).get('/api/slots?from=2030-07-01&to=2030-07-02').set('x-test-role', 'employee').expect(200);

        expect(slotDaoMock.getSlots).toHaveBeenCalledWith(new Date('2030-07-01'), new Date('2030-07-02'));
    });

    it('responds 422 if "from" is not a date', async () => {
        await request(app).get('/api/slots?from=yesterday').set('x-test-role', 'employee').expect(422);

        expect(slotDaoMock.getSlots).not.toHaveBeenCalled();
    });

    it('responds 500 if the database fails', async () => {
        slotDaoMock.getSlots.mockRejectedValue(new Error('DB down'));

        const res = await request(app).get('/api/slots').set('x-test-role', 'employee').expect(500);

        expect(res.body).toEqual({ error: 'Internal server error' });
    });
});

describe('GET /api/slots/:slotId', () => {
    it('returns the slot', async () => {
        slotDaoMock.getSlotById.mockResolvedValue(slot);

        const res = await request(app).get(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').expect(200);

        expect(res.body).toEqual(slot);
        expect(slotDaoMock.getSlotById).toHaveBeenCalledWith(SLOT_ID);
    });

    it('responds 404 if the slot does not exist', async () => {
        slotDaoMock.getSlotById.mockRejectedValue(new SlotError('SLOT_NOT_FOUND', 'Slot not found'));

        const res = await request(app).get(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').expect(404);

        expect(res.body).toEqual({ error: 'Slot not found' });
    });

    it('responds 422 if the id is not a UUID', async () => {
        await request(app).get('/api/slots/abc').set('x-test-role', 'employee').expect(422);

        expect(slotDaoMock.getSlotById).not.toHaveBeenCalled();
    });
});

describe('POST /api/slots', () => {
    it('creates the slot and responds 201', async () => {
        const body = validBody();
        slotDaoMock.createSlot.mockResolvedValue(slot);

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(body).expect(201);

        expect(res.body).toEqual(slot);
        expect(slotDaoMock.createSlot).toHaveBeenCalledWith({
            start: new Date(body.date_time_start),
            end: new Date(body.date_time_end),
            tableIds: [TABLE_ID],
        });
    });

    it('responds 422 if the slot starts in the past', async () => {
        const body = { ...validBody(), date_time_start: new Date(Date.now() - HOUR).toISOString() };

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(body).expect(422);

        expect(res.body.error).toContain('date_time_start must be in the future');
        expect(slotDaoMock.createSlot).not.toHaveBeenCalled();
    });

    it('responds 422 if the slot ends before it starts', async () => {
        const body = validBody();
        body.date_time_end = new Date(Date.now() + 23 * HOUR).toISOString();

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(body).expect(422);

        expect(res.body.error).toContain('date_time_end must be after date_time_start');
        expect(slotDaoMock.createSlot).not.toHaveBeenCalled();
    });

    it('responds 422 if a table id is not valid', async () => {
        const body = { ...validBody(), table_ids: ['T1'] };

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(body).expect(422);

        expect(res.body.error).toContain('each table id must be a valid UUID');
        expect(slotDaoMock.createSlot).not.toHaveBeenCalled();
    });

    it('responds 409 if the slot overlaps another one', async () => {
        slotDaoMock.createSlot.mockRejectedValue(new SlotError('SLOT_OVERLAP', 'The slot overlaps with an existing slot'));

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(validBody()).expect(409);

        expect(res.body).toEqual({ error: 'The slot overlaps with an existing slot' });
    });

    it('responds 422 if a table does not exist', async () => {
        slotDaoMock.createSlot.mockRejectedValue(new SlotError('TABLE_NOT_FOUND', 'One or more tables do not exist'));

        await request(app).post('/api/slots').set('x-test-role', 'employee').send(validBody()).expect(422);
    });

    it('responds 400 for a slot error without a specific status', async () => {
        slotDaoMock.createSlot.mockRejectedValue(new SlotError('UNKNOWN', 'Something went wrong'));

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(validBody()).expect(400);

        expect(res.body).toEqual({ error: 'Something went wrong' });
    });

    it('responds 500 on unexpected errors', async () => {
        slotDaoMock.createSlot.mockRejectedValue(new Error('DB down'));

        const res = await request(app).post('/api/slots').set('x-test-role', 'employee').send(validBody()).expect(500);

        expect(res.body).toEqual({ error: 'Internal server error' });
    });
});

describe('PUT /api/slots/:slotId', () => {
    it('updates the slot and responds 200', async () => {
        slotDaoMock.updateSlot.mockResolvedValue(slot);

        const res = await request(app).put(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').send(validBody()).expect(200);

        expect(res.body).toEqual(slot);
        expect(slotDaoMock.updateSlot).toHaveBeenCalledWith(SLOT_ID, expect.objectContaining({ tableIds: [TABLE_ID] }));
    });

    it('responds 409 if a removed table has reservations', async () => {
        slotDaoMock.updateSlot.mockRejectedValue(
            new SlotError('HAS_RESERVATIONS', 'Cannot remove a table that has reservations in this slot'),
        );

        await request(app).put(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').send(validBody()).expect(409);
    });

    it('responds 409 if the slot is being modified concurrently', async () => {
        slotDaoMock.updateSlot.mockRejectedValue(
            new SlotError('CONCURRENT_UPDATE', 'The slots are being modified by someone else, please try again'),
        );

        await request(app).put(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').send(validBody()).expect(409);
    });
});

describe('DELETE /api/slots/:slotId', () => {
    it('deletes the slot and responds 204', async () => {
        slotDaoMock.deleteSlot.mockResolvedValue();

        await request(app).delete(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').expect(204);

        expect(slotDaoMock.deleteSlot).toHaveBeenCalledWith(SLOT_ID);
    });

    it('responds 409 if the slot has reservations', async () => {
        slotDaoMock.deleteSlot.mockRejectedValue(new SlotError('HAS_RESERVATIONS', 'Cannot delete a slot that has reservations'));

        const res = await request(app).delete(`/api/slots/${SLOT_ID}`).set('x-test-role', 'employee').expect(409);

        expect(res.body).toEqual({ error: 'Cannot delete a slot that has reservations' });
    });
});
