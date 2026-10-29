import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter;

export const initMailer = async () => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
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

export const sendEmail = async (to, subject, text, html) => {
  if (!transporter) {
    await initMailer();
  }

  const info = await transporter.sendMail({
    from: '"Mountain Hut System" <no-reply@mountainhut.polito.it>',
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