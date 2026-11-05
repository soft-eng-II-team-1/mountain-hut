/**
 * Booking confirmation for MH-03 ("Receive confirmation").
 *
 * After a successful booking the hiker who made the reservation receives an
 * email with (from the user story clarifications):
 *  - the booking reference,
 *  - the date and time slot,
 *  - the party size,
 *  - the party requirements, if any (e.g. allergies),
 *  - the name of the hiker that made the reservation.
 */

import { sendEmail } from '../config/mailer.js';

/**
 * Builds the confirmation email of a reservation.
 *
 * @param {{ reservation_id: string, people: number, requirements: string | null,
 *           slot: { date_time_start: Date, date_time_end: Date },
 *           hiker: { name: string, surname: string, email: string } }} details
 *        output of ReservationDAO.getReservationDetails
 * @returns {{ to: string, subject: string, text: string, html?: string }}
 */
export function buildConfirmationEmail(details) {
    // TODO (MH-03) @Kamyar: Email template
    // Remember to escape details.requirements in the html, since it is written by the hiker.
    return {
        to: details.hiker.email,
        subject: 'Mountain Hut - Booking confirmation',
        text: JSON.stringify(details, null, 2),
    };
}

/**
 * Sends the confirmation email to the hiker who made the reservation.
 *
 * @param details output of ReservationDAO.getReservationDetails
 */
export async function sendReservationConfirmation(details) {
    const { to, subject, text, html } = buildConfirmationEmail(details);
    return sendEmail(to, subject, text, html);
}
