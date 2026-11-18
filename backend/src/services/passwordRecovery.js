import { sendEmail } from '../config/mailer.js';

const HUT_NAME = 'Fond des Fours Mountain Hut';
const RECOVERY_CODE_VALIDITY_MINUTES = 10;

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function buildRecoveryCodeEmail(to, recoveryCode) {
    const safeRecoveryCode = escapeHtml(recoveryCode);
    const subject = 'Mountain Hut - Password recovery code';
    const text = [
        'Hello,',
        '',
        'Use this code to reset your Mountain Hut account password:',
        recoveryCode,
        '',
        `This code expires in ${RECOVERY_CODE_VALIDITY_MINUTES} minutes.`,
        'If you did not request a password reset, you can ignore this email.',
        'Do not share this code with anyone.',
        '',
        HUT_NAME,
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="format-detection" content="telephone=no">
    <style>
      a[x-apple-data-detectors] {
        color: inherit !important;
        text-decoration: none !important;
      }
    </style>
  </head>
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
          <h1 style="margin:0 0 16px;font-size:20px;color:#cc6000;">Password recovery</h1>
          <p style="margin:0 0 16px;font-size:14px;">
            Use this code to reset your Mountain Hut account password:
          </p>
          <p style="margin:0 0 16px;padding:14px;background:#f3f5f7;border-radius:8px;
                    font-size:28px;font-weight:bold;letter-spacing:6px;text-align:center;">
            ${safeRecoveryCode}
          </p>
          <p style="margin:0 0 12px;font-size:14px;">
            This code expires in ${RECOVERY_CODE_VALIDITY_MINUTES} minutes.
          </p>
          <p style="margin:0;font-size:13px;color:#536b75;">
            If you did not request a password reset, you can ignore this email.
            Do not share this code with anyone.
          </p>
          <p style="margin:16px 0 0;font-size:14px;">${HUT_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    return { to, subject, text, html };
}

export async function sendRecoveryCodeEmail(to, recoveryCode) {
    const { subject, text, html } = buildRecoveryCodeEmail(to, recoveryCode);
    return sendEmail(to, subject, text, html);
}
