import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/mailer.js', () => ({
    sendEmail: jest.fn(),
}));

const { buildRecoveryCodeEmail, sendRecoveryCodeEmail } = await import('../../services/passwordRecovery.js');
const { sendEmail } = await import('../../config/mailer.js');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('buildRecoveryCodeEmail', () => {
    it('addresses the email and puts the code in both text and html', () => {
        const email = buildRecoveryCodeEmail('anna@test.it', '0123456789');

        expect(email.to).toBe('anna@test.it');
        expect(email.subject).toBe('Mountain Hut - Password recovery code');
        expect(email.text).toContain('0123456789');
        expect(email.html).toContain('0123456789');
    });

    it('tells the user the code expires in 10 minutes (same validity as the DAO)', () => {
        const email = buildRecoveryCodeEmail('anna@test.it', '0123456789');

        expect(email.text).toContain('This code expires in 10 minutes.');
        expect(email.html).toContain('This code expires in 10 minutes.');
    });

    it('tells the user to ignore the email if they did not ask for a reset', () => {
        const email = buildRecoveryCodeEmail('anna@test.it', '0123456789');

        expect(email.text).toContain('If you did not request a password reset, you can ignore this email.');
    });

    it('escapes HTML special characters in the html part', () => {
        const email = buildRecoveryCodeEmail('anna@test.it', `<script>"&'</script>`);

        expect(email.html).not.toContain('<script>');
        expect(email.html).toContain('&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
    });
});

describe('sendRecoveryCodeEmail', () => {
    it('sends the built email through the mailer and returns its result', async () => {
        sendEmail.mockResolvedValue({ messageId: 'id-1' });

        const result = await sendRecoveryCodeEmail('anna@test.it', '0123456789');

        const expected = buildRecoveryCodeEmail('anna@test.it', '0123456789');
        expect(sendEmail).toHaveBeenCalledWith('anna@test.it', expected.subject, expected.text, expected.html);
        expect(result).toEqual({ messageId: 'id-1' });
    });

    it('propagates mailer errors', async () => {
        sendEmail.mockRejectedValue(new Error('SMTP down'));

        await expect(sendRecoveryCodeEmail('anna@test.it', '0123456789')).rejects.toThrow('SMTP down');
    });
});
