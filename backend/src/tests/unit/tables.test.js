import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { TableError } from '../../dao/TableDAO.js';

// TableDAO mock: the router creates its DAO with "new TableDAO()", which returns this object
const tableDaoMock = {
    getTables: jest.fn(),
    getTableById: jest.fn(),
    createTable: jest.fn(),
    updateTable: jest.fn(),
    deleteTable: jest.fn(),
};

jest.unstable_mockModule('../../dao/TableDAO.js', () => ({
    default: tableDaoMock,
    TableError,
}));

const { default: tablesRouter } = await import('../../routes/tables.js');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    const role = req.get('x-test-role');
    req.isAuthenticated = () => Boolean(role);
    req.user = role ? { role } : undefined;
    next();
});
app.use('/api/tables', tablesRouter);
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));

const TABLE_ID = '11111111-1111-4111-8111-111111111111';

const table = {
    table_id: TABLE_ID,
    number: 'T1',
    seats: 4,
};

const validPostBody = () => ({ number: 'T1', seats: 4 });

const validPutBody = () => ({ number: 'T1', seats: 2 });

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GET /api/tables', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).get('/api/tables').expect(401);

        expect(tableDaoMock.getTables).not.toHaveBeenCalled();
    });

    it('responds 403 if logged in as hiker', async () => {
        await request(app).get('/api/tables').set('x-test-role', 'hiker').expect(403);

        expect(tableDaoMock.createTable).not.toHaveBeenCalled();
    });

    it('returns the list of tables', async () => {
        tableDaoMock.getTables.mockResolvedValue([]);

        const res = await request(app).get('/api/tables').set('x-test-role', 'employee').expect(200);

        expect(res.body).toEqual([]);
    });

    it('responds 500 if the database fails', async () => {
        tableDaoMock.getTables.mockRejectedValue(new Error('DB down'));

        const res = await request(app).get('/api/tables').set('x-test-role', 'employee').expect(500);

        expect(res.body).toEqual({ error: 'DB down' });
    });
});

describe('POST /api/tables', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).post('/api/tables').expect(401);

        expect(tableDaoMock.createTable).not.toHaveBeenCalled();
    });

    it('responds 403 if logged in as hiker', async () => {
        await request(app).post('/api/tables').set('x-test-role', 'hiker').send(validPostBody()).expect(403);

        expect(tableDaoMock.createTable).not.toHaveBeenCalled();
    });

    it('responds 422 if the table number is invalid', async () => {
        await request(app).post('/api/tables').set('x-test-role', 'employee').send({ number: '', seats: 1 }).expect(422);

        expect(tableDaoMock.createTable).not.toHaveBeenCalled();
    });

    it('responds 422 if the number of seats is invalid', async () => {
        await request(app).post('/api/tables').set('x-test-role', 'employee').send({ seats: 'invalid', number: 'T1' }).expect(422);

        expect(tableDaoMock.createTable).not.toHaveBeenCalled();
    });

    it('responds 409 if the table already exists', async () => {
        const prismaError = new Error('Table number already exists');
        prismaError.code = 'P2002';

        tableDaoMock.createTable.mockRejectedValue(prismaError);

        const res = await request(app)
            .post('/api/tables')
            .set('x-test-role', 'employee')
            .send(validPostBody())
            .expect(409);

        expect(res.body).toEqual({ error: 'Table number already exists' });
    });

    it('responds 500 on unexpected errors', async () => {
        tableDaoMock.createTable.mockRejectedValue(new Error('DB down'));

        const res = await request(app).post('/api/tables').set('x-test-role', 'employee').send(validPostBody()).expect(500);

        expect(res.body).toEqual({ error: 'DB down' });
    });

    it('creates a table and responds 201', async () => {
        const body = validPostBody();
        tableDaoMock.createTable.mockResolvedValue(table);

        const res = await request(app).post('/api/tables').set('x-test-role', 'employee').send(body).expect(201);

        expect(res.body).toEqual(table);
        expect(tableDaoMock.createTable).toHaveBeenCalledWith({ number: body.number, seats: body.seats });
    });
});

describe('PUT /api/tables/:tableId', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).put(`/api/tables/${TABLE_ID}`).expect(401);

        expect(tableDaoMock.updateTable).not.toHaveBeenCalled();
    });

    it('responds 403 if logged in as hiker', async () => {
        await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'hiker').send(validPutBody()).expect(403);

        expect(tableDaoMock.updateTable).not.toHaveBeenCalled();
    });

    it('responds 422 if the table id is not valid', async () => {
        await request(app).put('/api/tables/not-a-uuid').set('x-test-role', 'employee').send(validPutBody()).expect(422);

        expect(tableDaoMock.updateTable).not.toHaveBeenCalled();
    });

    it('responds 422 if the table number is invalid', async () => {
        await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').send({ number: '', seats: 1 }).expect(422);

        expect(tableDaoMock.updateTable).not.toHaveBeenCalled();
    });

    it('responds 422 if the number of seats is invalid', async () => {
        await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').send({ seats: 'invalid', number: 'T1' }).expect(422);

        expect(tableDaoMock.updateTable).not.toHaveBeenCalled();
    });

    it('responds 409 if the table already exists', async () => {
        const prismaError = new Error('Table number already exists');
        prismaError.code = 'P2002';

        tableDaoMock.updateTable.mockRejectedValue(prismaError);

        const res = await request(app)
            .put(`/api/tables/${TABLE_ID}`)
            .set('x-test-role', 'employee')
            .send(validPutBody())
            .expect(409);

        expect(res.body).toEqual({ error: 'Table number already exists' });
    });

    it('responds 404 if the table is not found', async () => {
        const prismaError = new Error('Table not found');
        prismaError.code = 'P2025';

        tableDaoMock.updateTable.mockRejectedValue(prismaError);

        const res = await request(app)
            .put(`/api/tables/${TABLE_ID}`)
            .set('x-test-role', 'employee')
            .send(validPutBody())
            .expect(404);

        expect(res.body).toEqual({ error: 'Table not found' });
    });

    it('responds 409 if there is a concurrent update', async () => {
        tableDaoMock.updateTable.mockRejectedValue(new TableError('CONCURRENT_UPDATE', 'The table is being modified by someone else, please try again'));

        const res = await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').send(validPutBody()).expect(409);

        expect(res.body).toEqual({ error: 'The table is being modified by someone else, please try again' });
    });

    it('responds 409 if the new seats are less than the max seats reserved in a slot', async () => {
        tableDaoMock.updateTable.mockRejectedValue(new TableError('SEATS_RESERVED', 'Cannot set fewer seats than the 10 already reserved on this table in a slot'));

        const res = await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').send(validPutBody()).expect(409);

        expect(res.body).toEqual({ error: 'Cannot set fewer seats than the 10 already reserved on this table in a slot' });
    });

    it('responds 500 on unexpected errors', async () => {
        tableDaoMock.updateTable.mockRejectedValue(new Error('DB down'));

        const res = await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').send(validPutBody()).expect(500);

        expect(res.body).toEqual({ error: 'DB down' });
    });

    it('responds 404 if the table is not found', async () => {
        const prismaError = new Error('Table not found');
        prismaError.code = 'P2025';

        tableDaoMock.updateTable.mockRejectedValue(prismaError);

        const res = await request(app)
            .put(`/api/tables/${TABLE_ID}`)
            .set('x-test-role', 'employee')
            .send(validPutBody())
            .expect(404);

        expect(res.body).toEqual({ error: 'Table not found' });
    });

    it('updates a table and responds 200', async () => {
        const body = validPutBody();
        tableDaoMock.updateTable.mockResolvedValue(table);

        const res = await request(app).put(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').send(body).expect(200);

        expect(res.body).toEqual(table);
        expect(tableDaoMock.updateTable).toHaveBeenCalledWith(TABLE_ID, { number: body.number, seats: body.seats });
    });
});

describe('DELETE /api/tables/:tableId', () => {
    it('responds 401 if not logged in', async () => {
        await request(app).delete(`/api/tables/${TABLE_ID}`).expect(401);

        expect(tableDaoMock.deleteTable).not.toHaveBeenCalled();
    });

    it('responds 403 if logged in as hiker', async () => {
        await request(app).delete(`/api/tables/${TABLE_ID}`).set('x-test-role', 'hiker').expect(403);

        expect(tableDaoMock.deleteTable).not.toHaveBeenCalled();
    });

    it('responds 422 if the table id is not valid', async () => {
        await request(app).delete('/api/tables/not-a-uuid').set('x-test-role', 'employee').expect(422);

        expect(tableDaoMock.deleteTable).not.toHaveBeenCalled();
    });

    it('responds 404 if the table is not found', async () => {
        const prismaError = new Error('Table not found');
        prismaError.code = 'P2025';

        tableDaoMock.deleteTable.mockRejectedValue(prismaError);

        await request(app).delete(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').expect(404);
    });

    it('responds 500 on unexpected errors', async () => {
        tableDaoMock.deleteTable.mockRejectedValue(new Error('DB down'));

        const res = await request(app).delete(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').expect(500);

        expect(res.body).toEqual({ error: 'DB down' });
    });

    it('responds 400 if the table is not found', async () => {
        tableDaoMock.deleteTable.mockRejectedValue(new Error("Cannot delete a table that is scheduled in a slot or has active reservations"));

        const res = await request(app).delete(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').expect(400);

        expect(res.body).toEqual({ error: "Cannot delete a table that is scheduled in a slot or has active reservations" });
    });

    it('deletes a table and responds 204', async () => {
        tableDaoMock.deleteTable.mockResolvedValue(table);

        await request(app).delete(`/api/tables/${TABLE_ID}`).set('x-test-role', 'employee').expect(204);

        expect(tableDaoMock.deleteTable).toHaveBeenCalledWith(TABLE_ID);
    });
});