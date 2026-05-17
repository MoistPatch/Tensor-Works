const { Pool } = require('pg');

let pool = null;

// ---------------------------------------------------------------------------
// connect — create the connection pool and verify connectivity
// ---------------------------------------------------------------------------
async function connect() {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  pool.on('error', (err) => {
    console.error(
      `[${new Date().toISOString()}] DB_POOL_ERROR error="${err.message}"`
    );
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log(
      `[${new Date().toISOString()}] DATABASE_CONNECTED url="${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}"`
    );
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] DATABASE_CONNECTION_FAILED error="${err.message}"`
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// setup — create tables if they do not already exist
// ---------------------------------------------------------------------------
async function setup() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_counters (
        year    INTEGER PRIMARY KEY,
        last_number INTEGER DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id                SERIAL PRIMARY KEY,
        stripe_payment_id VARCHAR(255) UNIQUE,
        invoice_number    VARCHAR(50)  UNIQUE,
        customer_email    VARCHAR(255),
        customer_name     VARCHAR(255),
        subtotal          DECIMAL(12,2),
        gst               DECIMAL(12,2),
        total             DECIMAL(12,2),
        status            VARCHAR(50)  DEFAULT 'paid',
        billing_address   JSONB,
        shipping_address  JSONB,
        items             JSONB,
        pdf_path          VARCHAR(500),
        email_sent_at     TIMESTAMPTZ,
        created_at        TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    console.log(
      `[${new Date().toISOString()}] DATABASE_SETUP_COMPLETE tables=orders,invoice_counters`
    );
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// getNextInvoiceNumber — atomically increment counter for the current year
// Returns a string like "2026-0001"
// ---------------------------------------------------------------------------
async function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const client = await pool.connect();
  try {
    // Upsert the row for this year, then increment atomically
    const result = await client.query(
      `INSERT INTO invoice_counters (year, last_number)
         VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE
         SET last_number = invoice_counters.last_number + 1
       RETURNING last_number`,
      [year]
    );
    const seq = result.rows[0].last_number;
    return `${year}-${String(seq).padStart(4, '0')}`;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// insertOrder — persist an order record
// ---------------------------------------------------------------------------
async function insertOrder(orderData, invoiceNumber, filePath) {
  const { stripePaymentId, email, items, shippingAddress, billingAddress, amount } =
    orderData;

  // Derive financials from items array when available
  const subtotal = items.reduce(
    (sum, item) => sum + (item.unit_price || 0) * (item.qty || 1),
    0
  );
  const gst = parseFloat((subtotal * 0.1).toFixed(2));
  const total = parseFloat((subtotal * 1.1).toFixed(2));

  const customerName =
    billingAddress?.name ||
    shippingAddress?.name ||
    null;

  const result = await pool.query(
    `INSERT INTO orders
       (stripe_payment_id, invoice_number, customer_email, customer_name,
        subtotal, gst, total, status, billing_address, shipping_address,
        items, pdf_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,$9,$10,$11)
     RETURNING *`,
    [
      stripePaymentId,
      invoiceNumber,
      email,
      customerName,
      subtotal || amount,
      gst,
      total || amount,
      JSON.stringify(billingAddress),
      JSON.stringify(shippingAddress),
      JSON.stringify(items),
      filePath,
    ]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// findByPaymentId — idempotency check
// ---------------------------------------------------------------------------
async function findByPaymentId(stripePaymentId) {
  const result = await pool.query(
    'SELECT * FROM orders WHERE stripe_payment_id = $1 LIMIT 1',
    [stripePaymentId]
  );
  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// updateStatus — update an order's status field
// ---------------------------------------------------------------------------
async function updateStatus(invoiceNumber, status) {
  const result = await pool.query(
    `UPDATE orders SET status = $1 WHERE invoice_number = $2 RETURNING *`,
    [status, invoiceNumber]
  );
  return result.rows[0] || null;
}

module.exports = {
  connect,
  setup,
  getNextInvoiceNumber,
  insertOrder,
  findByPaymentId,
  updateStatus,
};
