import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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