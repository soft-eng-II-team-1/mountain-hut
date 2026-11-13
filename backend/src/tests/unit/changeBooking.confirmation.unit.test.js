// MH-06 - Change a booking: the email sent after a change ('modified')
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/mailer.js', () => ({
    sendEmail: jest.fn(),
}));

const { buildConfirmationEmail, sendReservationConfirmation } = await import('../../services/reservationConfirmation.js');
const { sendEmail } = await import('../../config/mailer.js');

const details = {
    reservation_id: '123e4567-e89b-12d3-a456-426655440000',
    people: 5,
    requirements: 'Two children',
    slot: {
        date_time_start: new Date('2026-07-15T10:00:00Z'),
        date_time_end: new Date('2026-07-15T12:00:00Z'),
    },
    hiker: { name: 'Mario', surname: 'Rossi', email: 'mario.rossi@example.com' },
};

describe('Confirmation email of a changed booking', () => {
    it('says that the booking was updated and shows the new details', () => {
        const { to, subject, text, html } = buildConfirmationEmail(details, 'modified');

        expect(to).toBe('mario.rossi@example.com');
        expect(subject).toBe('Mountain Hut - Booking updated');
        expect(html).toContain('Booking updated');
        for (const body of [text, html]) {
            expect(body).toContain('has been updated. Here are the new details:');
            expect(body).toContain('123e4567-e89b-12d3-a456-426655440000');
            expect(body).toContain('5 people');
            expect(body).toContain('Two children');
        }
    });

    it('is sent with the "updated" subject', async () => {
        sendEmail.mockResolvedValue({ messageId: 'msg-1' });

        await sendReservationConfirmation(details, 'modified');

        expect(sendEmail).toHaveBeenCalledWith(
            'mario.rossi@example.com', 'Mountain Hut - Booking updated', expect.any(String), expect.any(String),
        );
    });
});
