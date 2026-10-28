import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initMailer, sendEmail } from './config/mailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Mountain Hut API is running' });
});

// Test email endpoint (useful to verify your email task works!)
app.post('/api/test-email', async (req: Request, res: Response) => {
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

app.listen(PORT, async () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  await initMailer();
});

export default app;