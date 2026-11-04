import express from 'express';
import { body, param, query } from 'express-validator';

import SlotDAO, { SlotError } from '../dao/SlotDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isStaff } from '../middlewares/auth.js';

const router = express.Router();
const slotDao = new SlotDAO();

// HTTP status for each SlotError code
const statusByCode = {
    SLOT_NOT_FOUND: 404,
    TABLE_NOT_FOUND: 422,
    SLOT_OVERLAP: 409,
    HAS_RESERVATIONS: 409,
    CONCURRENT_UPDATE: 409,
};

const handleError = (err, res, next) => {
    if (err instanceof SlotError) {
        return res.status(statusByCode[err.code] ?? 400).json({ error: err.message });
    }
    return next(err);
};

/*** Validation rules ***/

const slotIdParam = param('slotId').isUUID().withMessage('slotId must be a valid UUID');

// Body of POST and PUT: { date_time_start, date_time_end, table_ids }
const slotBodyRules = [
    body('date_time_start').isISO8601({ strict: true }).withMessage('date_time_start must be an ISO 8601 date-time')
        .bail()
        .custom((value) => new Date(value) > new Date()).withMessage('date_time_start must be in the future'),
    body('date_time_end').isISO8601({ strict: true }).withMessage('date_time_end must be an ISO 8601 date-time')
        .bail()
        .custom((value, { req }) => new Date(value) > new Date(req.body.date_time_start))
        .withMessage('date_time_end must be after date_time_start'),
    body('table_ids').isArray().withMessage('table_ids must be an array'),
    body('table_ids.*').isUUID().withMessage('each table id must be a valid UUID'),
];

const listRules = [
    query('from').optional().isISO8601().withMessage('from must be an ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('to must be an ISO 8601 date'),
];

const slotFromBody = (body) => ({
    start: new Date(body.date_time_start),
    end: new Date(body.date_time_end),
    tableIds: body.table_ids,
});

/*** Routes ***/

// GET /api/slots?from=...&to=...
// List of slots with their tables and total seats
router.get('/', isStaff, listRules, validateRequest, async (req, res, next) => {
    try {
        const from = req.query.from ? new Date(req.query.from) : undefined;
        const to = req.query.to ? new Date(req.query.to) : undefined;
        const slots = await slotDao.getSlots(from, to);
        return res.status(200).json(slots);
    } catch (err) {
        return next(err);
    }
});

// GET /api/slots/:slotId
router.get('/:slotId', isStaff, slotIdParam, validateRequest, async (req, res, next) => {
    try {
        const slot = await slotDao.getSlotById(req.params.slotId);
        return res.status(200).json(slot);
    } catch (err) {
        return handleError(err, res, next);
    }
});

// POST /api/slots
// Body: { date_time_start, date_time_end, table_ids }
router.post('/', isStaff, slotBodyRules, validateRequest, async (req, res, next) => {
    try {
        const slot = await slotDao.createSlot(slotFromBody(req.body));
        return res.status(201).json(slot);
    } catch (err) {
        return handleError(err, res, next);
    }
});

// PUT /api/slots/:slotId
// Body: { date_time_start, date_time_end, table_ids } - table_ids replaces the whole list
router.put('/:slotId', isStaff, slotIdParam, slotBodyRules, validateRequest, async (req, res, next) => {
    try {
        const slot = await slotDao.updateSlot(req.params.slotId, slotFromBody(req.body));
        return res.status(200).json(slot);
    } catch (err) {
        return handleError(err, res, next);
    }
});

// DELETE /api/slots/:slotId
router.delete('/:slotId', isStaff, slotIdParam, validateRequest, async (req, res, next) => {
    try {
        await slotDao.deleteSlot(req.params.slotId);
        return res.status(204).end();
    } catch (err) {
        return handleError(err, res, next);
    }
});

export default router;