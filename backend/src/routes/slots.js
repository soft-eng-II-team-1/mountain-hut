import express from 'express';
import { body, param, query } from 'express-validator';

import SlotDAO, { SlotError } from '../dao/SlotDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isStaff } from '../middlewares/auth.js';
import { normalizeMenu, parseMenu, validateMenu } from '../services/menuFormatter.js';

const router = express.Router();
const slotDao = new SlotDAO();

// HTTP status for each SlotError code
const statusByCode = {
    SLOT_NOT_FOUND: 404,
    TABLE_NOT_FOUND: 422,
    SLOT_OVERLAP: 409,
    HAS_RESERVATIONS: 409,
    CONCURRENT_UPDATE: 409,
    SLOT_STARTED: 409,
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

// Body of PUT /:slotId/menu and POST /menus/preview: { menu } (see services/menuFormatter.js for the format)
const menuBodyRules = [
    body('menu').isString().withMessage('menu must be a string')
        .bail()
        .custom((value) => {
            const errors = validateMenu(value);
            if (errors.length > 0) {
                throw new Error(errors.join('; '));
            }
            return true;
        }),
];

const previousMenusRules = [
    query('q').optional().isString().withMessage('q must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
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

/*** MH-10: menus ***/
// These routes come before /:slotId, otherwise "menus" would be read as a slotId

// GET /api/slots/menus?q=...&limit=...
// Menus already defined in some slot, to reuse (and change) them for another slot
//staff only
router.get('/menus', isStaff, previousMenusRules, validateRequest, async (req, res, next) => {
    try {
        // Express 5 does not keep the sanitized query values, so they are converted here
        const menus = await slotDao.getPreviousMenus({
            search: req.query.q?.trim() || undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        });
        return res.status(200).json(menus);
    } catch (err) {
        return next(err);
    }
});

// POST /api/slots/menus/preview
// Body: { menu } - checks and formats a menu without saving it (e.g. live preview while writing it)
//staff only
router.post('/menus/preview', isStaff, menuBodyRules, validateRequest, (req, res) => {
    const menu = normalizeMenu(req.body.menu);
    return res.status(200).json({ menu, menu_blocks: parseMenu(menu) });
});

// PUT /api/slots/:slotId/menu
// Body: { menu } - sets or replaces the menu of a slot that has not started yet
//staff only
router.put('/:slotId/menu', isStaff, slotIdParam, menuBodyRules, validateRequest, async (req, res, next) => {
    try {
        const slot = await slotDao.setMenu(req.params.slotId, req.body.menu);
        return res.status(200).json(slot);
    } catch (err) {
        return handleError(err, res, next);
    }
});

// DELETE /api/slots/:slotId/menu
// Removes the menu of a slot that has not started yet
//staff only
router.delete('/:slotId/menu', isStaff, slotIdParam, validateRequest, async (req, res, next) => {
    try {
        await slotDao.deleteMenu(req.params.slotId);
        return res.status(204).end();
    } catch (err) {
        return handleError(err, res, next);
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