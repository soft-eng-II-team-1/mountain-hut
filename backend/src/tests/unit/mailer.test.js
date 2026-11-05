import { jest } from '@jest/globals';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn().mockReturnValue({
    sendMail: mockSendMail,
});
const mockCreateTestAccount = jest.fn().mockResolvedValue({
    user: 'test_ethereal_user',
    pass: 'test_ethereal_pass',
});
const mockGetTestMessageUrl = jest.fn().mockReturnValue('https://ethereal.email/message/123');

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: mockCreateTransport,
        createTestAccount: mockCreateTestAccount,
        getTestMessageUrl: mockGetTestMessageUrl,
    },
}));

const { initMailer, sendEmail } = await import('../../config/mailer.js');

describe('Mailer Service (mailer.js)', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...ORIGINAL_ENV };
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    describe('initMailer', () => {
        test('should configure transporter with process.env credentials when provided', async () => {
            process.env.SMTP_USER = 'user@example.com';
            process.env.SMTP_PASS = 'secret_password';
            process.env.SMTP_HOST = 'smtp.customhost.com';
            process.env.SMTP_PORT = '465';

            await initMailer();

            expect(mockCreateTransport).toHaveBeenCalledWith({
                host: 'smtp.customhost.com',
                port: 465,
                auth: {
                    user: 'user@example.com',
                    pass: 'secret_password',
                },
                secure: true,
            });
            expect(mockCreateTestAccount).not.toHaveBeenCalled();
        });

        test('should use fallback host and port when SMTP_HOST and SMTP_PORT are not set', async () => {
            process.env.SMTP_USER = 'user@example.com';
            process.env.SMTP_PASS = 'secret_password';
            delete process.env.SMTP_HOST;
            delete process.env.SMTP_PORT;

            await initMailer();

            expect(mockCreateTransport).toHaveBeenCalledWith({
                host: 'smtp.gmail.com',
                port: 465,
                auth: {
                    user: 'user@example.com',
                    pass: 'secret_password',
                },
                secure: false,
            });
        });

        test('should generate an Ethereal test account if SMTP_USER or SMTP_PASS are missing', async () => {
            delete process.env.SMTP_USER;
            delete process.env.SMTP_PASS;

            await initMailer();

            expect(mockCreateTestAccount).toHaveBeenCalledTimes(1);
            expect(mockCreateTransport).toHaveBeenCalledWith({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: 'test_ethereal_user',
                    pass: 'test_ethereal_pass',
                },
            });
        });
    });

    describe('sendEmail', () => {
        test('should call initMailer automatically if transporter is not initialized', async () => {
            jest.resetModules();

            const mockSendMailAuto = jest.fn().mockResolvedValue({ messageId: 'auto-init-123' });

            jest.unstable_mockModule('nodemailer', () => ({
                default: {
                    createTransport: jest.fn().mockReturnValue({
                        sendMail: mockSendMailAuto,
                    }),
                    createTestAccount: jest.fn().mockResolvedValue({
                        user: 'auto_user',
                        pass: 'auto_pass',
                    }),
                    getTestMessageUrl: jest.fn(),
                },
            }));

            const freshMailer = await import('../../config/mailer.js');

            const result = await freshMailer.sendEmail('test@example.com', 'Subject', 'Text');

            expect(mockSendMailAuto).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ messageId: 'auto-init-123' });
        });

        test('should send an email with all specified parameters (including HTML)', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'msg-id-123' });
            process.env.SMTP_USER = 'mountain_hut_system@example.com';

            const result = await sendEmail(
                'recipient@example.com',
                'Test Subject',
                'Plain text body',
                '<h1>HTML body</h1>'
            );

            expect(mockSendMail).toHaveBeenCalledWith({
                from: '"Mountain Hut System" <mountain_hut_system@example.com>',
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Plain text body',
                html: '<h1>HTML body</h1>',
            });
            expect(result).toEqual({ messageId: 'msg-id-123' });
        });

        test('should fallback to plain text for HTML if html argument is omitted', async () => {
            mockSendMail.mockResolvedValueOnce({ messageId: 'msg-id-456' });

            await sendEmail('recipient@example.com', 'Test Subject', 'Plain text only');

            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'Plain text only',
                    html: 'Plain text only',
                })
            );
        });

        test('should invoke getTestMessageUrl after sending', async () => {
            const fakeInfo = { messageId: 'msg-id-789' };
            mockSendMail.mockResolvedValueOnce(fakeInfo);

            await sendEmail('recipient@example.com', 'Test Subject', 'Plain text body');

            expect(mockGetTestMessageUrl).toHaveBeenCalledWith(fakeInfo);
        });
    });
});