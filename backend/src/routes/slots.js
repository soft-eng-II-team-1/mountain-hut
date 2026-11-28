import express from 'express';
import { body, param, query } from 'express-validator';

import SlotDAO, { SlotError } from '../dao/SlotDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isStaff } from '../middlewares/auth.js';
import { isMonday, weekBounds } from '../services/hutTime.js';

const router = express.Router();
const slotDao = new SlotDAO();

// HTTP status for each SlotError code
const statusByCode = {
    SLOT_NOT_FOUND: 404,
    TABLE_NOT_FOUND: 422,
    SOURCE_WEEK_EMPTY: 422,
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

//rules for the hiker input info to find available slots
const availableSlotsRules = [
    query('partySize').exists({ values: 'falsy' }).withMessage('partySize is required').bail().isInt({ min: 1 }).withMessage('partySize must be a positive integer').toInt(),
    query('from').exists({ values: 'falsy' }).withMessage('from is required').bail().isISO8601().withMessage('from must be an ISO 8601 date'),
    query('to').exists({ values: 'falsy' }).withMessage('to is required').bail().isISO8601().withMessage('to must be an ISO 8601 date').bail().custom((value, { req }) => new Date(value) > new Date(req.query.from)).withMessage('to must be after from'),
];

// Body of POST /copy-week: { source_week_start, target_week_start, include_menu? }
// Weeks are given as the date of their Monday, "YYYY-MM-DD"
const weekStartRule = (field) => body(field)
    .isDate({ format: 'YYYY-MM-DD', strictMode: true }).withMessage(`${field} must be a date in the format YYYY-MM-DD`)
    .bail()
    .custom(isMonday).withMessage(`${field} must be a Monday`);

const copyWeekRules = [
    weekStartRule('source_week_start'),
    weekStartRule('target_week_start')
        .bail()
        .custom((value, { req }) => value !== req.body.source_week_start)
        .withMessage('target_week_start must be different from source_week_start')
        .bail()
        .custom((value) => weekBounds(value).start > new Date())
        .withMessage('target_week_start must be a week in the future'),
    body('include_menu').optional().isBoolean({ strict: true }).withMessage('include_menu must be a boolean')
        .toBoolean(true),
];

const slotFromBody = (body) => ({
    start: new Date(body.date_time_start),
    end: new Date(body.date_time_end),
    tableIds: body.table_ids,
});

/*** Routes ***/

// GET /api/slots?from=...&to=...
// List of slots with their tables and total seats
//staff only
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

// GET /api/slots/available?partySize=...&from=...&to=...
// List of available slots for hikers to book
router.get('/available', availableSlotsRules, validateRequest, async (req, res, next) => {
    try {
        const slots = await slotDao.getAvailableSlots({
            partySize: Number(req.query.partySize),
            from: new Date(req.query.from),
            to: new Date(req.query.to)
        });
        return res.status(200).json(slots);
    } catch (err) {
        return next(err);
    }
});

// GET /api/slots/:slotId
//staff only
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

// POST /api/slots/copy-week
// Replaces all the slots of the target week with a copy of the source week (MH-09).
// The menu is copied only if include_menu is true
router.post('/copy-week', isStaff, copyWeekRules, validateRequest, async (req, res, next) => {
    try {
        const result = await slotDao.copyWeek({
            sourceWeekStart: req.body.source_week_start,
            targetWeekStart: req.body.target_week_start,
            includeMenu: req.body.include_menu === true,
        });
        return res.status(201).json(result);
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