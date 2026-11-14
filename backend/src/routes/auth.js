import express from 'express';
import { body } from 'express-validator';

import passport from 'passport';
import UserDAO from '../dao/UserDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isLoggedIn } from '../middlewares/auth.js';
import { hikerProfileRules } from '../middlewares/userRules.js';

const router = express.Router();
const userDAO = new UserDAO();

const loginRules = [
    body('email').trim().toLowerCase().isEmail().withMessage('A valid email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
];

const signupRules = [
    ...hikerProfileRules,
    body('password').isString()
        .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters long'),
];

// POST /api/auth/signup
//registers a new hiker and opens a session for them
router.post('/signup', signupRules, validateRequest, async (req, res, next) => {
    try{
        const { name, surname, email, phone, notes, emergency_contact, password } = req.body;
        const user = await userDAO.createUser({ name, surname, email, phone, notes, emergency_contact, password });
        
        if(!user) {
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

export default router;