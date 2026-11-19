// MH-05 - Party requirements: how the requirements are shown in the confirmation email
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/mailer.js', () => ({
    sendEmail: jest.fn(),
}));

const { buildConfirmationEmail } = await import('../../services/reservationConfirmation.js');

const details = {
    reservation_id: '123e4567-e89b-12d3-a456-426655440000',
    people: 4,
    slot: {
        date_time_start: new Date('2026-07-15T10:00:00Z'),
        date_time_end: new Date('2026-07-15T12:00:00Z'),
    },
    hiker: { name: 'Mario', surname: 'Rossi', email: 'mario.rossi@example.com' },
};

// Example of the user story, in the order of ReservationDAO.getReservationDetails (allergies first)
const STORY_EXAMPLE = [
    { allergies: true, description: '1 shellfish allergy' },
    { allergies: true, description: '1 vegan, peanut allergy' },
    { allergies: false, description: '2 vegetarians' },
];

describe('Confirmation email - party requirements', () => {
    it.each(['created', 'modified'])('lists every requirement and marks the allergies (%s booking)', (kind) => {
        const { text, html } = buildConfirmationEmail({ ...details, requirements: STORY_EXAMPLE }, kind);

        const expected = 'ALLERGY: 1 shellfish allergy; ALLERGY: 1 vegan, peanut allergy; 2 vegetarians';
        expect(text).toContain(`Requirements: ${expected}`);
        expect(html).toContain(expected);
    });

    it('does not mark the requirements without allergies', () => {
        const { text } = buildConfirmationEmail({ ...details, requirements: [{ allergies: false, description: '2 vegetarians' }] });

        expect(text).toContain('Requirements: 2 vegetarians');
        expect(text).not.toContain('ALLERGY');
    });

    it('escapes every description in the html', () => {
        const { html } = buildConfirmationEmail({
            ...details,
            requirements: [
                { allergies: true, description: '<b>nuts</b>' },
                { allergies: false, description: '<script>alert("x")</script>' },
            ],
        });

        expect(html).not.toContain('<b>nuts</b>');
        expect(html).not.toContain('<script>');
        expect(html).toContain('ALLERGY: &lt;b&gt;nuts&lt;/b&gt;; &lt;script&gt;');
    });

    it('shows "None" when the requirements are missing', () => {
        const { text } = buildConfirmationEmail(details);

        expect(text).toContain('Requirements: None');
    });
});
