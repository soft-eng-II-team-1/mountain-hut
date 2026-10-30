import Router from 'express';
import ReservationDAO from '../dao/ReservationDAO.js';
import { isLoggedIn } from '../middleware/auth.js';

const router = Router();

router.get('/slots/:slotId/availability', isLoggedIn, async (req, res) => {
  try {
    const { slotId } = req.params;
    const partySize = Number(req.query.partySize);

    if (!Number.isInteger(partySize) || partySize <= 0) {
      return res.status(400).json({ error: "A valid positive integer partySize query parameter is required" });
    }

    const availability = await ReservationDAO.checkAvailability(slotId, partySize);
    
    if (!availability.available) {
      return res.status(400).json({ error: "Insufficient seats available for this party size" });
    }

    res.status(200).json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;