import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/mailer.js', () => ({
    sendEmail: jest.fn(),
}));

const { buildConfirmationEmail, sendReservationConfirmation } = await import('../../services/reservationConfirmation.js');
const { sendEmail } = await import('../../config/mailer.js');

describe('Reservation Confirmation Service', () => {
    const mockDetails = {
        reservation_id: '123e4567-e89b-12d3-a456-426655440000',
        people: 4,
        requirements: 'Vegetarian meals required',
        slot: {
            date_time_start: new Date('2026-07-15T10:00:00Z'),
            date_time_end: new Date('2026-07-15T12:00:00Z'),
        },
        hiker: {
            name: 'Mario',
            surname: 'Rossi',
            email: 'mario.rossi@example.com',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('buildConfirmationEmail', () => {
        test('should build the email with recipient, subject, text and html', () => {
            const email = buildConfirmationEmail(mockDetails);

            expect(email.to).toBe('mario.rossi@example.com');
            expect(email.subject).toBe('Mountain Hut - Booking confirmation');
            expect(typeof email.text).toBe('string');
            expect(typeof email.html).toBe('string');
        });

        test('should include the reservation details in text and html', () => {
            const { text, html } = buildConfirmationEmail(mockDetails);

            for (const body of [text, html]) {
                expect(body).toContain('123e4567-e89b-12d3-a456-426655440000');
                expect(body).toContain('Mario Rossi');
                expect(body).toContain('Wednesday, 15 July 2026');
                // 10:00Z -> 12:00 in Europe/Rome (CEST)
                expect(body).toContain('12:00 - 14:00');
                expect(body).toContain('4 people');
                expect(body).toContain('Vegetarian meals required');
            }
        });

        test('should escape user-written text in the html', () => {
            const { html } = buildConfirmationEmail({
                ...mockDetails,
                requirements: '<script>alert("x")</script>',
            });

            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        test('should show "None" when there are no requirements', () => {
            const { text } = buildConfirmationEmail({ ...mockDetails, requirements: null });

            expect(text).toContain('Requirements: None');
        });

        test('should list the tables when provided', () => {
            const { text } = buildConfirmationEmail({
                ...mockDetails,
                tables: [
                    { number: 'T02', seats_reserved: 3 },
                    { number: 'T04', seats_reserved: 1 },
                ],
            });

            expect(text).toContain('Tables: T02 (3 seats), T04 (1 seat)');
        });


        test('should correctly extract the recipient email address', () => {
            const customDetails = {
                ...mockDetails,
                hiker: { ...mockDetails.hiker, email: 'test.hiker@domain.org' },
            };

            const email = buildConfirmationEmail(customDetails);

            expect(email.to).toBe('test.hiker@domain.org');
        });
    });

    describe('sendReservationConfirmation', () => {
        test('should call sendEmail with parameters provided by buildConfirmationEmail', async () => {
            sendEmail.mockResolvedValue({ messageId: 'msg-123' });
            const expected = buildConfirmationEmail(mockDetails);

            const result = await sendReservationConfirmation(mockDetails);

            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail).toHaveBeenCalledWith(
                expected.to,
                expected.subject,
                expected.text,
                expected.html,
            );
            expect(result).toEqual({ messageId: 'msg-123' });
        });


        test('should propagate errors when sendEmail fails', async () => {
            const networkError = new Error('SMTP connection failure');
            sendEmail.mockRejectedValue(networkError);

            await expect(sendReservationConfirmation(mockDetails)).rejects.toThrow('SMTP connection failure');
        });
    });
});