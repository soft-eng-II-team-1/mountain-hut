import { Router } from 'express'
import ReservationDAO from '../dao/ReservationDAO.js';
import { isLoggedIn, isHiker } from '../middlewares/auth.js';

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/slots/:slotId/availability', isLoggedIn, async (req, res) => {
    try {
        const { slotId } = req.params;
        const partySize = Number(req.query.partySize);

        if (!UUID_REGEX.test(slotId)) {
            return res.status(400).json({ error: "Invalid slot_id" });
        }

        if (!Number.isInteger(partySize) || partySize <= 0) {
            return res.status(400).json({ error: "A valid positive integer partySize query parameter is required" });
        }

        const availability = await ReservationDAO.checkAvailability(slotId, partySize);

        if (!availability.available) {
            return res.status(400).json({ error: "Insufficient seats available for this party size" });
        }

        res.status(200).json(availability);
    } catch (error) {
        if (error.message === "No tables are assigned to this slot yet.") {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Only hikers can book a table (requirement of MH-01)
router.post('/slots/:slotId/reservations', isHiker, async (req, res) => {
    try {
        const { slotId } = req.params;
        const people = Number(req.body.people);

        if (!UUID_REGEX.test(slotId)) {
            return res.status(400).json({ error: "Invalid slot_id" });
        }

        if (!Number.isInteger(people) || people <= 0) {
            return res.status(400).json({ error: "Invalid input: 'people' must be a positive integer" });
        }

        const newReservation = await ReservationDAO.saveReservation(req.user.user_id, slotId, people);
        res.status(201).json(newReservation);
    } catch (error) {
        if (error.message === "Slot not found") {
            return res.status(404).json({ error: error.message });
        }
        if (
            error.message === "You already have a reservation for this time slot" ||
            error.message === "The slot is being booked by other hikers, please try again"
        ) {
            return res.status(409).json({ error: error.message });
        }
        if (
            error.message === "Insufficient seats available for this party size" ||
            error.message === "Reservations must be made at least 2 hours before the slot starts" ||
            error.message === "No tables are assigned to this slot yet."
        ) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;
