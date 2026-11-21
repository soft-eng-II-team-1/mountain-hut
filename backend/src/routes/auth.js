import express from 'express';
import { body } from 'express-validator';
import crypto from 'node:crypto';

import passport from 'passport';
import UserDAO from '../dao/UserDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isLoggedIn } from '../middlewares/auth.js';
import { hikerProfileRules } from '../middlewares/userRules.js';
import { sendRecoveryCodeEmail } from '../services/passwordRecovery.js';

const router = express.Router();
const userDAO = new UserDAO();
const RECOVERY_CODE_LENGTH = 10;

const loginRules = [
    body('email').trim().toLowerCase().isEmail().withMessage('A valid email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
];

const signupRules = [
    ...hikerProfileRules,
    body('password').isString()
        .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters long'),
    body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 256 }).withMessage('Notes are too long'),
    body('emergency_contact').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Emergency contact information is too long'),
];

const changePasswordRules = [
    body('oldPassword').isString().notEmpty().withMessage('Old password is required'),
    body('newPassword').isString()
        .isLength({ min: 8, max: 128 }).withMessage('New password must be 8-128 characters long'),
];

const resetPasswordRules = [
    body('email').trim().toLowerCase().isEmail().withMessage('A valid email is required'),
    body('recoveryCode')
        .isString().withMessage('Recovery code must be a string')
        .bail().matches(new RegExp(`^\\d{${RECOVERY_CODE_LENGTH}}$`))
        .withMessage(`Recovery code must contain exactly ${RECOVERY_CODE_LENGTH} digits`),
    body('newPassword').isString()
        .isLength({ min: 8, max: 128 }).withMessage('New password must be 8-128 characters long'),
];

// POST /api/auth/signup
//registers a new hiker and opens a session for them
router.post('/signup', signupRules, validateRequest, async (req, res, next) => {
    try {
        const { name, surname, email, phone, notes, emergency_contact, password } = req.body;
        const user = await userDAO.createUser({ name, surname, email, phone, notes, emergency_contact, password });

        if (!user) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        req.login(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.status(201).json(user);
        });

    } catch (err) {
        return next(err);
    }
});

// POST /api/auth/login
//logs in a hiker and opens a session for them
router.post('/login', loginRules, validateRequest, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(401).json({ error: info?.message ?? 'Email or password is incorrect' });
        }
        req.login(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.status(200).json(req.user);
        });
    })(req, res, next);
});

// POST /api/auth/logout
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        return res.status(200).end();
    });
});


// GET /api/auth/user
//returns the user object of the currently logged in user
router.get('/user', isLoggedIn, (req, res) => {
    res.status(200).json(req.user);
});

// PUT /api/auth/password
//changes the password of the currently logged in user
router.put('/password', isLoggedIn, changePasswordRules, validateRequest, async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const result = await userDAO.changeUserPassword(req.user.email, oldPassword, newPassword);
        if (!result) {
            //code lets the client tell a wrong old password apart from an expired session (also 401)
            return res.status(401).json({ error: 'Old credentials are incorrect', code: 'INVALID_OLD_PASSWORD' });
        }
        const updatedUser = {...req.user, first_login: false}; //update session to first_login: false
        req.login(updatedUser, (err) => {
            if(err) {
                return next(err);
            }
            return res.status(200).json(updatedUser);
        });
    } catch (err) {
        return next(err);
    }
});

// POST /api/auth/password-reset/request
//requests a password reset email to be sent to the given email address
router.post('/password-reset/request', body('email').trim().toLowerCase().isEmail().withMessage('A valid email is required'), validateRequest, async (req, res, next) => {
    try {
        const { email } = req.body;
        const recoveryCode = crypto.randomInt(0, 10 ** RECOVERY_CODE_LENGTH)
            .toString().padStart(RECOVERY_CODE_LENGTH, '0');
        const result = await userDAO.saveRecoveryCode(email, recoveryCode);
        if (result) {
            try {
                await sendRecoveryCodeEmail(email, recoveryCode);
            } catch (error) {
                console.error('Password recovery email delivery failed', error);
            }
        }

        return res.status(202).json({message: 'If an account exists for this email, recovery instructions will be sent'});
    } catch (err) {
        return next(err);
    }
});

// POST /api/auth/password-reset/confirm
//confirms a password reset request and changes the password of the user
router.post('/password-reset/confirm', resetPasswordRules, validateRequest, async (req, res, next) => {
    try {
        const { email, recoveryCode, newPassword } = req.body;
        const result = await userDAO.resetPasswordWithRecoveryCode(email, recoveryCode, newPassword);
        if (!result) {
            return res.status(400).json({ error: 'Password recovery not confirmed' });
        }
        return res.status(200).end();
    } catch (err) {
        return next(err);
    }
});

export default router;