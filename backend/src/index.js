import { initMailer } from './config/mailer.js';
import app from './app.js';

const PORT = process.env.PORT || 3000;

// The mailer is initialized once, before accepting requests
await initMailer();

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;