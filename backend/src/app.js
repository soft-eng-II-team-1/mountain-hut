import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import session from 'express-session';

import { sendEmail } from './config/mailer.js';

import UserDao from './dao/UserDAO.js';
const userDao = new UserDao();

import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use(morgan('dev'));

passport.use(new LocalStrategy({ usernameField: 'email' }, async function verify(email, password, callback) {
  try {
    const user = await userDao.getUser(email, password);

    if (!user) {
      return callback(null, false, { message: "Email or password incorrect" });
    }
    else {
      return callback(null, user);
    }
  } catch (error) {
    return callback(error);
  }
}));

passport.serializeUser(function (user, callback) {
  callback(null, user);
});

passport.deserializeUser(function (user, callback) {
  callback(null, user);
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // = 86.400.000 millisecondi (esattamente 1 giorno)
  }
}));

app.use(passport.authenticate('session'));

app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Mountain Hut API is running' });
});

// Test email endpoint (useful to verify your email task works!)
app.post('/api/test/email', async (req, res) => {
  try {
    const { to = 'hiker@example.com' } = req.body;
    await sendEmail(
      to,
      'Mountain Hut - Configuration Test',
      'Your emailing system configuration is working properly!'
    );
    res.status(200).json({ message: 'Test email sent! Check backend terminal for the preview link.' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

export default app;