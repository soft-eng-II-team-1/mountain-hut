import { Router } from 'express'
import {body, param, query } from 'express-validator';

import ReservationDAO, {ReservationError} from '../dao/ReservationDAO.js';
import { sendReservationConfirmation } from '../services/reservationConfirmation.js';
import validateRequest from '../middlewares/validateParams.js';
import { isLoggedIn, isHiker } from '../middlewares/auth.js';


const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_REQUIREMENTS_LENGTH = 500;

//party requirements: null/empty text --> null, invalid --> undefined
const parseRequirements = (value) => {
    if (value == null) 
        return null;
    if(typeof value !== 'string' || value.trim().length > MAX_REQUIREMENTS_LENGTH) 
        return undefined;
    return value.trim() || null;
}

//HTTP status of each reservation error code
const RESERVATION_ERROR_STATUS = {
    NOT_FOUND: 404,
    SLOT_NOT_FOUND: 404,
    TOO_LATE: 400,
    INSUFFICIENT_SEATS: 400,
    ALREADY_BOOKED: 409,
    CONCURRENT_UPDATE: 409,
}

// Sends the booking confirmation (MH-03). Returns false instead of throwing when the
// email cannot be sent: the reservation is already saved and must not fail because of it
const sendConfirmation = async (reservationId, kind = 'created') => {
    try {
        const details = await ReservationDAO.getReservationDetails(reservationId);
        await sendReservationConfirmation(details, kind);
        return true;
    } catch (error) {
        console.error(`Confirmation email for reservation ${reservationId} not sent:`, error);
        return false;
    }
};

// Reservation of the logged hiker, or null if it does not exist or belongs to someone else
// (in both cases the client gets a 404, so it cannot find out the reservations of others)
const getOwnReservation = async (req) => {
    const details = await ReservationDAO.getReservationDetails(req.params.reservationId);
    if (!details || details.hiker.user_id !== req.user.user_id) {
        return null;
    }
    return details;
};

router.get('/slots/:slotId/availability', isLoggedIn, async (req, res) => {
    try {
        const { slotId } = req.params;
        const partySize = Number(req.query.partySize);

        if (!UUID_REGEX.test(slotId)) {
                        return res.status(422).json({ errors: [{ field: 'slotId', message: 'slotId must be a valid UUID' }] });
        }

        if (!Number.isInteger(partySize) || partySize <= 0) {
            return res.status(422).json({ errors: [{ field: 'partySize', message: 'partySize must be a positive integer' }] });
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
                return res.status(422).json({ errors: [{ field: 'slotId', message: 'slotId must be a valid UUID' }] });
        }

        if (!Number.isInteger(people) || people <= 0) {
            return res.status(422).json({ errors: [{ field: 'people', message: 'people must be a positive integer' }] });
        }

        // Optional requirements of the party (e.g. allergies): an empty text means no requirements
        let requirements = req.body.requirements ?? null;
        if (requirements !== null) {
            if (typeof requirements !== 'string' || requirements.trim().length > MAX_REQUIREMENTS_LENGTH) {
                return res.status(422).json({ errors: [{ field: 'requirements', message: `requirements must be a text of at most ${MAX_REQUIREMENTS_LENGTH} characters` }] });
            }
            requirements = requirements.trim() || null;
        }

        const newReservation = await ReservationDAO.saveReservation(req.user.user_id, slotId, people, requirements);

        // MH-03: the hiker receives a confirmation email with the details of the booking
        const confirmationSent = await sendConfirmation(newReservation.reservation_id);

        res.status(201).json({ ...newReservation, confirmation_sent: confirmationSent });
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

// GET /api/reservations/:reservationId
// Details of the booking confirmation (MH-03), only for the hiker who made the reservation
router.get('/reservations/:reservationId', isHiker, async (req, res) => {
    try {
        if (!UUID_REGEX.test(req.params.reservationId)) {
            return res.status(422).json({ errors: [{ field: 'reservationId', message: 'reservationId must be a valid UUID' }] });
        }

        const details = await getOwnReservation(req);
        if (!details) {
            return res.status(404).json({ error: "Reservation not found" });
        }

        res.status(200).json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//PUT /api/reservations/:reservationId
//changes slot, party size and requirements of a reservation of a logged hiker
//allowed up to 48h before the slot starts
//full new state is sent (All fields are required, requirement field can be null)
router.put('/reservations/:reservationId', isHiker, async (req, res) => {
    try {
        const { reservationId } = req.params;
        const slotId = typeof req.body.slot_id === 'string' ? req.body.slot_id.toLowerCase() : req.body.slot_id; 
        const people = Number(req.body.people);
        const requirements = req.body.requirements === undefined ? undefined : parseRequirements(req.body.requirements);

        const errors = [];
        if(!UUID_REGEX.test(reservationId)) {
            errors.push({field: 'reservationId', message: 'reservationId must be a valid UUID'});  
        }
        
        if (typeof slotId !== 'string' || !UUID_REGEX.test(slotId)) {
            errors.push({ field: 'slot_id', message: 'slot_id must be a valid UUID' });
        }
        if (!Number.isInteger(people) || people <= 0) {
            errors.push({ field: 'people', message: 'people must be a positive integer' });
        }
        if (requirements === undefined) {
            errors.push({ field: 'requirements', message: `requirements must be null or a text of at most ${MAX_REQUIREMENTS_LENGTH} characters` });
        }
        if (errors.length) {
            return res.status(422).json({ errors });
        }

        const { changed } = await ReservationDAO.updateReservation(
            reservationId, req.user.user_id, { slotId, people, requirements }
        );

        //hiker receives an email only if something actually changed
        const confirmationSent = changed ? await sendConfirmation(reservationId, 'modified') : false;

        const details = await ReservationDAO.getReservationDetails(reservationId);
        res.status(200).json({ ...details, changed, confirmation_sent: confirmationSent });
    } catch (error) {
        if (error instanceof ReservationError) {
            return res.status(RESERVATION_ERROR_STATUS[error.code] ?? 500).json({ error: error.message });
        }
        // Thrown by checkAvailability when moving to a slot without tables
        if (error.message === "No tables are assigned to this slot yet.") {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});


// POST /api/reservations/:reservationId/confirmation
// Sends the confirmation email again (e.g. if it was not sent at booking time, see confirmation_sent)
router.post('/reservations/:reservationId/confirmation', isHiker, async (req, res) => {
    try {
        if (!UUID_REGEX.test(req.params.reservationId)) {
            return res.status(422).json({ errors: [{ field: 'reservationId', message: 'reservationId must be a valid UUID' }] });
        }

        const details = await getOwnReservation(req);
        if (!details) {
            return res.status(404).json({ error: "Reservation not found" });
        }

        try {
            await sendReservationConfirmation(details);
        } catch (error) {
            console.error(`Confirmation email for reservation ${details.reservation_id} not sent:`, error);
            return res.status(500).json({ error: "Failed to send the confirmation email" });
        }

        res.status(200).json({ message: `Confirmation email sent to ${details.hiker.email}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
