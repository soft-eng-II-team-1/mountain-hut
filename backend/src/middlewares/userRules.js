import { body } from 'express-validator';

// Personal data of a hiker, shared by the self signup (POST /api/auth/signup)
// and by the account created by the staff (POST /api/hikers, MH-07)
export const hikerProfileRules = [
    body('name').trim().notEmpty().withMessage('Name is required')
        .isLength({ max: 50 }).withMessage('Name is too long'),
    body('surname').trim().notEmpty().withMessage('Surname is required')
        .isLength({ max: 50 }).withMessage('Surname is too long'),
    body('email').trim().toLowerCase().isEmail().withMessage('A valid email is required'),
    body('phone').optional({ values: 'falsy' }).trim()
        .matches(/^\+?[0-9 ]{6,20}$/).withMessage('Phone number is not valid'),
    body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 256 }).withMessage('Notes are too long'),
    body('emergency_contact').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Emergency contact information is too long'),
];
