require('dotenv').config();

const express = require('express');
const fs = require('fs');
const database = require('./services/database');

// ---------------------------------------------------------------------------
// Required environment variable validation
// ---------------------------------------------------------------------------
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'DATABASE_URL',
];

const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error(
    `[${new Date().toISOString()}] FATAL: Missing required environment variables:\n  ${missingVars.join('\n  ')}\n` +
      'Copy .env.example to .env and fill in all required values before starting.'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Ensure invoices output directory exists
// ---------------------------------------------------------------------------
fs.mkdirSync('./invoices', { recursive: true });

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Health check — no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stripe webhooks router (uses raw body — must be mounted BEFORE any
// global express.json() or express.urlencoded() middleware)
const stripeWebhook = require('./webhooks/stripe');
app.use('/webhooks/stripe', stripeWebhook);

// ---------------------------------------------------------------------------
// Database initialisation and server start
// ---------------------------------------------------------------------------
(async () => {
  try {
    await database.connect();
    await database.setup();
    app.listen(PORT, () => {
      console.log(
        `[${new Date().toISOString()}] TensorWorks invoice service listening on port ${PORT}`
      );
    });
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] FATAL: Failed to initialise database: ${err.message}`
    );
    process.exit(1);
  }
})();
