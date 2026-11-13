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

// The hut's time zone: slot times are shown in local hut time,
// whatever time zone the server (or Docker container) runs in
const HUT_TIME_ZONE = 'Europe/Rome';
const HUT_NAME = 'Fond des Fours Mountain Hut';

//text that change between reservation confirmation of a new booking (MH-3) and reservation confirmation of an update (MH-6)

//TO BE REWRITTEN ONCE THE EMAIL TEMPALTE IS DONE - FOR NOW THERE ARE PLACEHOLDERS FOR THE UPDATE EMAIL
const EMAIL_TEXT = {
  created: {
    subject: 'Mountain Hut - Booking confirmation',
    title: 'Booking confirmed',
    intro: `your table at ${HUT_NAME} is booked. Here are the details:`,
  }, 
  modified: { //PLACEHOLDERS 
    subject: 'Mountain Hut - Booking updated',
    title: 'Booking updated',
    intro: `your table at ${HUT_NAME} has been updated. Here are the new details:`,
  }
}

// Escapes text written by users before putting it in the html
const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// "Wednesday, 15 July 2026"
const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: HUT_TIME_ZONE,
});

// "12:00"
const formatTime = (date) => new Date(date).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: HUT_TIME_ZONE,
});

// "T02 (3 seats), T04 (1 seat)"
const formatTables = (tables) => tables
    .map((t) => `${t.number} (${t.seats_reserved} ${t.seats_reserved === 1 ? 'seat' : 'seats'})`)
    .join(', ');

/**
 * Builds the confirmation email of a reservation.
 *
 * @param {{ reservation_id: string, people: number, requirements: string | null,
 *           slot: { date_time_start: Date, date_time_end: Date },
 *           hiker: { name: string, surname: string, email: string },
 *           tables?: { number: string, seats_reserved: number }[] }} details
 *        output of ReservationDAO.getReservationDetails
 * @param {'created' | 'modified'} [kind] new booking (MH-03) or update booking (MH-06)
 * @returns {{ to: string, subject: string, text: string, html: string }}
 */
export function buildConfirmationEmail(details, kind = 'created') {
    const texts = EMAIL_TEXT[kind];
    const { reservation_id, people, requirements, slot, hiker, tables = [] } = details;

    const fullName = `${hiker.name} ${hiker.surname}`;
    const date = formatDate(slot.date_time_start);
    const time = `${formatTime(slot.date_time_start)} - ${formatTime(slot.date_time_end)}`;
    const party = `${people} ${people === 1 ? 'person' : 'people'}`;
    const notes = requirements?.trim() || 'None';

    // label / value rows shared by the text and the html version
    const rows = [
        ['Booking reference', reservation_id],
        ['Name', fullName],
        ['Date', date],
        ['Time', time],
        ['Party size', party],
        ...(tables.length ? [['Tables', formatTables(tables)]] : []),
        ['Requirements', notes],
    ];

    const text = [
        `Dear ${fullName},`,
        '',
        texts.intro,
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        'Please keep the booking reference: you may need it to change or cancel the reservation.',
        '',
        'See you in the mountains!',
        HUT_NAME,
    ].join('\n');

    // every value is escaped: requirements and the name are written by the hiker
    const htmlRows = rows.map(([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#536b75;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;color:#23404d;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#23404d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#536b75;padding:20px 24px;color:#ffffff;">
          <div style="font-size:18px;font-weight:bold;letter-spacing:0.5px;">FOND DES FOURS</div>
          <div style="font-size:11px;letter-spacing:0.5px;">MOUNTAIN HUT</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#cc6000;">${escapeHtml(texts.title)}</h1>
          <p style="margin:0 0 16px;font-size:14px;">Dear ${escapeHtml(fullName)},<br>
            ${escapeHtml(texts.intro)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0"
                 style="width:100%;font-size:14px;border:1px solid #d5dbe0;border-radius:8px;">${htmlRows}
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#536b75;">
            Please keep the booking reference: you may need it to change or cancel the reservation.</p>
          <p style="margin:16px 0 0;font-size:14px;">See you in the mountains!<br>${escapeHtml(HUT_NAME)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    return {
        to: hiker.email,
        subject: texts.subject,
        text,
        html,
    };
}

/**
 * Sends the confirmation email to the hiker who made the reservation.
 *
 * @param details output of ReservationDAO.getReservationDetails
 * @param {'created' | 'modified'} [kind] new booking (MH-03) or update booking (MH-06)
 * */
export async function sendReservationConfirmation(details, kind = 'created') {
    const { to, subject, text, html } = buildConfirmationEmail(details, kind);
    return sendEmail(to, subject, text, html);
}
