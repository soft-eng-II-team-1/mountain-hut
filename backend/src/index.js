import { initMailer } from './config/mailer.js';
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await initMailer();
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;