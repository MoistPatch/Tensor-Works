# TensorWorks Invoice Service

Automated invoice PDF generation and email delivery triggered by Stripe `payment_intent.succeeded` webhooks.

## Stack

- **Node.js / Express** — webhook receiver
- **PDFKit** — A4 invoice PDF generation
- **SendGrid** — transactional email with PDF attachment
- **PostgreSQL** — order records and sequential invoice numbering
- **Stripe** — payment events and signature verification

---

## Setup

### 1. Install dependencies

```bash
cd invoice-service
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all values:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) from Stripe dashboard |
| `SENDGRID_API_KEY` | SendGrid API key (`SG.…`) |
| `SENDGRID_FROM_EMAIL` | Verified sender address (default: `sales@tensorworks.online`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port (default: `3000`) |

> The service will refuse to start if any required variable is missing.

### 3. Create the PostgreSQL database

```bash
createdb tensorworks
# or use your hosting provider's dashboard
```

### 4. Create database tables

```bash
node -e "require('./services/database').connect().then(() => require('./services/database').setup())"
```

This creates two tables:

- **`orders`** — full order records with invoice number, financials, addresses, and items
- **`invoice_counters`** — atomic sequential counter per calendar year (produces `INV-2026-0001`, `INV-2026-0002`, …)

### 5. Start the service

```bash
# Production
npm start

# Development (auto-restart on file change)
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2026-01-01T00:00:00.000Z"}
```

---

## Stripe Webhook Configuration

### Register the endpoint

1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. URL: `https://your-domain.com/webhooks/stripe`
3. Events to listen for: **`payment_intent.succeeded`**
4. Copy the **Signing secret** (`whsec_…`) into your `.env`

### Required Stripe PaymentIntent metadata

When creating a PaymentIntent on your storefront, set these metadata fields so the invoice service can build the PDF and email:

```js
stripe.paymentIntents.create({
  amount: 385000,          // cents (AUD)
  currency: 'aud',
  receipt_email: 'customer@example.com',
  metadata: {
    email: 'customer@example.com',
    items: JSON.stringify([
      {
        description: 'Custom AI Workstation — RTX 4090 Build',
        qty: 1,
        unit_price: 350000.00   // AUD, excl. GST
      }
    ]),
    billingAddress: JSON.stringify({
      name: 'Jane Smith',
      company: 'Acme Corp',
      line1: '123 Tech Street',
      city: 'Sydney',
      state: 'NSW',
      postal_code: '2000',
      country: 'AU'
    }),
    shippingAddress: JSON.stringify({
      name: 'Jane Smith',
      line1: '123 Tech Street',
      city: 'Sydney',
      state: 'NSW',
      postal_code: '2000',
      country: 'AU'
    })
  }
})
```

### Test locally with Stripe CLI

```bash
# Install Stripe CLI then:
stripe listen --forward-to localhost:3000/webhooks/stripe

# In another terminal, trigger a test event:
stripe trigger payment_intent.succeeded
```

---

## Invoice numbering

Invoices follow the format **`INV-YYYY-NNNN`** (e.g. `INV-2026-0001`). The counter resets each calendar year and is stored atomically in PostgreSQL — safe under concurrent load.

---

## File structure

```
invoice-service/
├── server.js                  # App entry point
├── package.json
├── .env.example
├── webhooks/
│   └── stripe.js              # Stripe webhook handler
├── services/
│   ├── invoiceGenerator.js    # PDFKit invoice builder
│   ├── emailService.js        # SendGrid email + retry logic
│   └── database.js            # PostgreSQL pool + queries
└── invoices/                  # Generated PDFs (gitignored)
    └── .gitkeep
```

---

## Deployment

### Railway (recommended)

1. Push this directory to a GitHub repo
2. Create a new Railway project → Deploy from GitHub
3. Add a PostgreSQL plugin — Railway sets `DATABASE_URL` automatically
4. Set the remaining environment variables in Railway's Variables tab
5. Railway will run `npm start` automatically

### Render

1. New Web Service → connect GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add a Render PostgreSQL database and link via `DATABASE_URL`
5. Set remaining env vars in the Environment tab

### VPS / Docker

```bash
# On the server
git clone <your-repo>
cd invoice-service
npm install --production
# Set env vars, then:
npm start
# Or use PM2 for process management:
pm2 start server.js --name tensorworks-invoice
```

---

## Logging

All log lines include an ISO timestamp and relevant IDs. Sensitive values (API keys, card numbers) are never logged. Look for these prefixes in your log aggregator:

| Prefix | Meaning |
|---|---|
| `INVOICE_GENERATED` | PDF written to disk successfully |
| `EMAIL_SUCCESS` | SendGrid accepted the message |
| `EMAIL_FAILED` | SendGrid error (retried automatically) |
| `WEBHOOK_ERROR` | Any processing step failed — includes `step=` context |
| `ADMIN_ALERT` | Manual intervention required — Stripe payment not fully processed |
| `WEBHOOK_SKIP` | Duplicate event ignored (idempotency) |

---

## Business rules

- **GST**: 10% Australian GST applied to all line items
- **Terms**: Net 30 from invoice date
- **Currency**: AUD only
- **Deposits**: 50% deposit required for custom builds (enforced at quoting stage)
- **Quote numbers**: `Q-YYYY-NNNN` format (managed separately)
- **ABN**: 84 544 119 830
