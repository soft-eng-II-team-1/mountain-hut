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
        test('should build the correct email object from reservation details', () => {
            const email = buildConfirmationEmail(mockDetails);

            expect(email).toEqual({
                to: 'mario.rossi@example.com',
                subject: 'Mountain Hut - Booking confirmation',
                text: JSON.stringify(mockDetails, null, 2),
            });
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

            const result = await sendReservationConfirmation(mockDetails);

            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail).toHaveBeenCalledWith(
                'mario.rossi@example.com',
                'Mountain Hut - Booking confirmation',
                JSON.stringify(mockDetails, null, 2),
                undefined
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