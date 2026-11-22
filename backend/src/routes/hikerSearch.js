import express from 'express';
import { query, matchedData } from 'express-validator';

import UserDAO from '../dao/UserDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isStaff } from '../middlewares/auth.js';

const router = express.Router();
const userDAO = new UserDAO();

const SEARCH_FIELDS = ['email', 'name', 'phone'];

// a criterion is given when it is a non-empty string (repeated parameters, e.g. ?name=a&name=b, are rejected)
const isGiven = (value) => typeof value === 'string' && value.trim() !== '';
const isSingleValue = (value) => typeof value === 'string';

// same limits as signup (routes/auth.js): name and surname are free text, max 50 characters each,
// so the search accepts every registered name, also written in full as "name surname"
const NAME_MAX_LENGTH = 50;
const FULL_NAME_MAX_LENGTH = NAME_MAX_LENGTH * 2 + 1;

// NFC: an accent typed as base letter + combining mark (NFD) matches the precomposed one;
// repeated spaces are collapsed, so "Mario   Rossi" has the same length as "Mario Rossi"
const normalizeName = (value) => value.normalize('NFC').replace(/\s+/g, ' ').trim();

const searchRules = [
    query().custom((params) => SEARCH_FIELDS.some((field) => isGiven(params[field])))
        .withMessage('At least one of email, name or phone is required'),
    query('email').optional({ values: 'falsy' })
        .custom(isSingleValue).withMessage('email must be given only once').bail()
        .trim().toLowerCase().isEmail().withMessage('email must be a valid email'),
    query('name').optional({ values: 'falsy' })
        .custom(isSingleValue).withMessage('name must be given only once').bail()
        .customSanitizer(normalizeName)
        // a blank name ("   ") becomes "" and is ignored by the handler, like a missing one
        .isLength({ max: FULL_NAME_MAX_LENGTH })
        .withMessage(`name must be at most ${FULL_NAME_MAX_LENGTH} characters long`),
    query('phone').optional({ values: 'falsy' })
        .custom(isSingleValue).withMessage('phone must be given only once').bail()
        .trim().matches(/^\+?[0-9 ]+$/).withMessage('phone can contain only digits, spaces and a leading +').bail()
        .custom((value) => {
            const digits = value.replace(/\D/g, '').length;
            return digits >= 3 && digits <= 20;
        }).withMessage('phone must contain 3-20 digits'),
];

// GET /api/hikers?email=...&name=...&phone=...
//MH-07: an employee (or the warden) looks for a hiker already registered, to reserve on their behalf
//(phone call, party arriving at the hut). At least one criterion, the given ones are combined in AND.
//email is unique: exact match. name and phone: partial match, several hikers can be returned
//Mounted on /api/hikers next to the router of POST /api/hikers (routes/hikers.js)
router.get('/', isStaff, searchRules, validateRequest, async (req, res, next) => {
    try {
        // sanitized values (in Express 5 req.query is read-only, so the sanitizers do not change it)
        const { email, name, phone } = matchedData(req, { locations: ['query'] });
        const hikers = await userDAO.searchHikers({
            email: email || undefined,
            name: name || undefined,
            phone: phone || undefined,
        });
        return res.status(200).json(hikers);
    } catch (err) {
        return next(err);
    }
});

export default router;
