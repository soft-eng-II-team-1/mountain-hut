import express from 'express';
import { body } from 'express-validator';

import UserDAO from '../dao/UserDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import { isWarden } from '../middlewares/auth.js';    

const router = express.Router();
const userDAO = new UserDAO();

const employeeRules = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('surname').trim().notEmpty().withMessage('Surname is required'),
    body('email').trim().toLowerCase().isEmail().withMessage('A valid email is required'),
    body('phone').optional({ values: 'falsy' }).trim()
        .matches(/^\+?[0-9 ]{6,20}$/).withMessage('Phone number is not valid'),
    body('password').isString()
        .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters long'),
];

// POST /api/warden/employees
//registers a new employee and opens a session for them
router.post('/employees', isWarden, employeeRules, validateRequest, async (req, res, next) => { 
    try {
        const { name, surname, email, phone, password } = req.body;
        const user = await userDAO.createUser({ name, surname, email, phone, password, role: 'employee' }); 

        if (!user) {
            return res.status(409).json({ error: 'Email already registered' });
        } 
        return res.status(201).json(user);
    } catch (err) {
        return next(err);
    }   
});

export default router;