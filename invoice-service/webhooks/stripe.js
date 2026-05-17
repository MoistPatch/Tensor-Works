const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const invoiceGenerator = require('../services/invoiceGenerator');
const emailService = require('../services/emailService');
const database = require('../services/database');

const router = express.Router();

// Stripe requires the raw request body for signature verification
router.use(express.raw({ type: 'application/json' }));

// ---------------------------------------------------------------------------
// POST /webhooks/stripe
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const timestamp = new Date().toISOString();
  let event;

  // Always respond 200 quickly so Stripe doesn't retry unnecessarily;
  // we do the heavy lifting asynchronously after responding.
  res.sendStatus(200);

  // -------------------------------------------------------------------------
  // Signature verification
  // -------------------------------------------------------------------------
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(
      `[${timestamp}] WEBHOOK_ERROR step=signature_verification error="${err.message}"`
    );
    return; // Already responded 200 above
  }

  // -------------------------------------------------------------------------
  // Only process payment_intent.succeeded events
  // -------------------------------------------------------------------------
  if (event.type !== 'payment_intent.succeeded') {
    return;
  }

  const paymentIntent = event.data.object;
  const stripePaymentId = paymentIntent.id;

  // -------------------------------------------------------------------------
  // Idempotency — skip if we have already processed this payment
  // -------------------------------------------------------------------------
  try {
    const existing = await database.findByPaymentId(stripePaymentId);
    if (existing) {
      console.log(
        `[${timestamp}] WEBHOOK_SKIP paymentId=${stripePaymentId} reason="duplicate — already processed as invoice ${existing.invoice_number}"`
      );
      return;
    }
  } catch (err) {
    console.error(
      `[${timestamp}] WEBHOOK_ERROR paymentId=${stripePaymentId} step=idempotency_check error="${err.message}"`
    );
    // Continue processing — better to send a duplicate than miss an order
  }

  // -------------------------------------------------------------------------
  // Extract metadata
  // -------------------------------------------------------------------------
  let items = [];
  let shippingAddress = {};
  let billingAddress = {};

  try {
    const meta = paymentIntent.metadata || {};

    items = meta.items ? JSON.parse(meta.items) : [];
    shippingAddress = meta.shippingAddress ? JSON.parse(meta.shippingAddress) : {};
    billingAddress = meta.billingAddress ? JSON.parse(meta.billingAddress) : {};
  } catch (err) {
    console.error(
      `[${timestamp}] WEBHOOK_ERROR paymentId=${stripePaymentId} step=metadata_parse error="${err.message}"`
    );
    // Alert admin and abort — without items we cannot produce a valid invoice
    await alertAdmin(stripePaymentId, 'metadata_parse', err.message);
    return;
  }

  const email =
    paymentIntent.metadata?.email ||
    paymentIntent.receipt_email ||
    null;

  const amount = paymentIntent.amount / 100; // cents → dollars

  const orderData = {
    stripePaymentId,
    email,
    amount,
    items,
    shippingAddress,
    billingAddress,
    timestamp: new Date().toISOString(),
  };

  // -------------------------------------------------------------------------
  // Generate PDF invoice
  // -------------------------------------------------------------------------
  let invoiceNumber, filePath;

  try {
    ({ invoiceNumber, filePath } = await invoiceGenerator.generate(orderData));
    console.log(
      `[${timestamp}] INVOICE_GENERATED paymentId=${stripePaymentId} invoiceNumber=${invoiceNumber} path=${filePath}`
    );
  } catch (err) {
    console.error(
      `[${timestamp}] WEBHOOK_ERROR paymentId=${stripePaymentId} step=invoice_generation error="${err.message}"`
    );
    await alertAdmin(stripePaymentId, 'invoice_generation', err.message);
    return;
  }

  // -------------------------------------------------------------------------
  // Persist order record (non-blocking relative to email send)
  // -------------------------------------------------------------------------
  database.insertOrder(orderData, invoiceNumber, filePath).catch((err) => {
    console.error(
      `[${timestamp}] WEBHOOK_ERROR paymentId=${stripePaymentId} step=database_insert error="${err.message}"`
    );
  });

  // -------------------------------------------------------------------------
  // Send invoice email
  // -------------------------------------------------------------------------
  try {
    await emailService.sendInvoice(orderData, invoiceNumber, filePath);
    console.log(
      `[${timestamp}] EMAIL_SENT paymentId=${stripePaymentId} invoiceNumber=${invoiceNumber} to=${email}`
    );
  } catch (err) {
    console.error(
      `[${timestamp}] WEBHOOK_ERROR paymentId=${stripePaymentId} step=email_send error="${err.message}"`
    );
    await alertAdmin(stripePaymentId, 'email_send', err.message);
  }
});

// ---------------------------------------------------------------------------
// alertAdmin — log a structured alert for monitoring/alerting systems to pick up
// ---------------------------------------------------------------------------
async function alertAdmin(paymentId, step, errorMessage) {
  const ts = new Date().toISOString();
  console.error(
    `[${ts}] ADMIN_ALERT paymentId=${paymentId} step=${step} error="${errorMessage}" action="manual_intervention_required"`
  );
}

module.exports = router;
