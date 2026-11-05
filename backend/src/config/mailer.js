import nodemailer from 'nodemailer';

let transporter;
// Promise of the last initialization: concurrent emails wait for the same one,
// so the transporter (and the Ethereal test account) is created only once
let initPromise;

const createTransporter = async () => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      secure: Number(process.env.SMTP_PORT) === 465,
    });
    console.log('Email system configured with .env credentials.');
  } else {
    // Automatically generate a working test account for local development
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`Email test system ready (Ethereal User: ${testAccount.user})`);
  }
};

// Called once at startup (see index.js). Every call creates a new transporter
export const initMailer = () => {
  const promise = createTransporter().catch((error) => {
    // Lets the next email try again instead of failing forever
    if (initPromise === promise) {
      initPromise = undefined;
    }
    throw error;
  });
  initPromise = promise;
  return promise;
};

export const sendEmail = async (to, subject, text, html) => {
  // Normally already done at startup; here only if it was not (e.g. in the tests).
  // If an initialization is in progress, waits for it instead of starting another one
  await (initPromise ?? initMailer());

  const info = await transporter.sendMail({
    from: `"Mountain Hut System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html: html || text,
  });

  console.log(`Message sent: ${info.messageId}`);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Preview Email URL: ${previewUrl}`);
  }
  return info;
};