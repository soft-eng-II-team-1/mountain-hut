import express from 'express';

import HikeDAO from '../dao/HikeDAO.js';
import { isEmployee } from '../middlewares/auth.js';

const router = express.Router();
const hikeDao = new HikeDAO();

// GET /api/hikes/active
//MH-21: an employee sees all the hikers currently on a hike (started and completed = false),
//with destination, route, intermediate passage points and expected return time (date_time_end)
router.get('/active', isEmployee, async (req, res, next) => {
    try {
        const hikes = await hikeDao.getActiveHikes();
        return res.status(200).json(hikes);
    } catch (err) {
        return next(err);
    }
});

export default router;
