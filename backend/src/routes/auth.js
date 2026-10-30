import express from 'express';
import passport from 'passport';

import { isLoggedIn } from '../middlewares/auth.js';

const router = express.Router();

router.post('/login', passport.authenticate('local'), (req, res) => {
    res.json(req.user);
});

router.post('/logout', (req, res) => {
    req.logout(() => {
        res.end();
    });
});

router.get('/user', isLoggedIn, (req, res) => {
    res.status(200).json(req.user);
});

export default router;