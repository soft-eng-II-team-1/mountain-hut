import express from 'express';

import UserDAO from '../dao/UserDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { hikerProfileRules } from '../middlewares/userRules.js';
import { isStaff } from '../middlewares/auth.js';
import { generatePassword } from '../services/passwordGenerator.js';

const router = express.Router();
const userDAO = new UserDAO();

// POST /api/hikers
//MH-07: an employee (or the warden) creates a full hiker account for a hiker that books by phone/in person.
//The password is generated here and returned only in this response (to be told to the hiker)
//the hiker must change it at the first login (first_login = true)
router.post('/', isStaff, hikerProfileRules, validateRequest, async (req, res, next) => {
    try {
        // password, role and first_login are never taken from the body
        const { name, surname, email, phone, notes, emergency_contact } = req.body;
        const password = generatePassword();

        const user = await userDAO.createUser({
            name, surname, email, phone, notes, emergency_contact, password,
            role: 'hiker',
            first_login: true,
        });

        if (!user) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // the response contains a password in clear text: it must not be cached
        res.set('Cache-Control', 'no-store');
        return res.status(201).json({ ...user, generated_password: password });
    } catch (err) {
        return next(err);
    }
});

export default router;
