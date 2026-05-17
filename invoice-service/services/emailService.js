const sgMail = require('@sendgrid/mail');
const fs = require('fs');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL || 'sales@tensorworks.online';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value) {
  return (
    '$' +
    Number(value).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addressBlock(addr) {
  if (!addr || typeof addr !== 'object') return '—';
  const lines = [];
  if (addr.company) lines.push(addr.company);
  if (addr.name) lines.push(addr.name);
  if (addr.line1) lines.push(addr.line1);
  if (addr.line2) lines.push(addr.line2);
  const cityState = [addr.city, addr.state].filter(Boolean).join(', ');
  if (cityState) lines.push(cityState);
  const postCountry = [addr.postal_code, addr.country].filter(Boolean).join(' ');
  if (postCountry) lines.push(postCountry);
  return lines.join('<br>') || '—';
}

// ---------------------------------------------------------------------------
// buildHtml — construct the email body
// ---------------------------------------------------------------------------
function buildHtml(orderData, invoiceNumber) {
  const { items = [], shippingAddress = {}, amount, timestamp, email } = orderData;

  const subtotal = items.reduce(
    (sum, item) => sum + (item.unit_price || item.price || 0) * (item.qty || item.quantity || 1),
    0
  );
  const gst = subtotal * 0.1;
  const totalDue = subtotal * 1.1 || amount;

  const itemRows = items
    .map((item) => {
      const qty = item.qty || item.quantity || 1;
      const unitPrice = item.unit_price || item.price || 0;
      const total = unitPrice * qty * 1.1;
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#333333;">${item.description || item.name || ''}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#333333;text-align:center;">${qty}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#333333;text-align:right;">${formatCurrency(unitPrice)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#333333;text-align:right;">${formatCurrency(total)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Order Confirmation — Invoice ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- ==================== HEADER ==================== -->
          <tr>
            <td style="background-color:#0D7377;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:1px;">TENSORWORKS</span><br>
                    <span style="font-size:12px;color:#a8dfe1;">AI Hardware Solutions | Custom Builds | OEM/ODM Services</span>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="font-size:13px;color:#a8dfe1;">tensorworks.online</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ==================== BODY ==================== -->
          <tr>
            <td style="padding:32px 36px 0 36px;">
              <h2 style="margin:0 0 6px 0;font-size:20px;color:#0D7377;">Thank you for your order!</h2>
              <p style="margin:0 0 24px 0;font-size:14px;color:#555555;">
                Your payment has been received and your invoice is attached to this email.
              </p>

              <!-- Order summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e0e0e0;border-radius:4px;">
                <tr style="background-color:#0D7377;">
                  <td colspan="2" style="padding:10px 14px;font-size:13px;font-weight:bold;color:#ffffff;">Order Summary</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-size:13px;color:#555555;width:50%;border-bottom:1px solid #f0f0f0;">Invoice #</td>
                  <td style="padding:10px 14px;font-size:13px;color:#333333;font-weight:bold;border-bottom:1px solid #f0f0f0;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-size:13px;color:#555555;border-bottom:1px solid #f0f0f0;">Date</td>
                  <td style="padding:10px 14px;font-size:13px;color:#333333;border-bottom:1px solid #f0f0f0;">${formatDate(new Date(timestamp))}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-size:13px;color:#555555;border-bottom:1px solid #f0f0f0;">Amount (AUD)</td>
                  <td style="padding:10px 14px;font-size:13px;color:#333333;font-weight:bold;border-bottom:1px solid #f0f0f0;">${formatCurrency(totalDue)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-size:13px;color:#555555;">Status</td>
                  <td style="padding:10px 14px;">
                    <span style="background-color:#76B900;color:#ffffff;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:12px;">PAID</span>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              ${
                items.length > 0
                  ? `<h3 style="margin:0 0 10px 0;font-size:15px;color:#0D7377;">Items Ordered</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;">
                <tr style="background-color:#f7f7f7;">
                  <th style="padding:9px 10px;font-size:12px;color:#555555;text-align:left;font-weight:bold;border-bottom:1px solid #e0e0e0;">Description</th>
                  <th style="padding:9px 10px;font-size:12px;color:#555555;text-align:center;font-weight:bold;border-bottom:1px solid #e0e0e0;">Qty</th>
                  <th style="padding:9px 10px;font-size:12px;color:#555555;text-align:right;font-weight:bold;border-bottom:1px solid #e0e0e0;">Unit Price</th>
                  <th style="padding:9px 10px;font-size:12px;color:#555555;text-align:right;font-weight:bold;border-bottom:1px solid #e0e0e0;">Total (incl. GST)</th>
                </tr>
                ${itemRows}
                <tr style="background-color:#f7f7f7;">
                  <td colspan="3" style="padding:10px;font-size:13px;color:#555555;text-align:right;font-weight:bold;">Subtotal (excl. GST)</td>
                  <td style="padding:10px;font-size:13px;color:#333333;text-align:right;">${formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding:10px;font-size:13px;color:#555555;text-align:right;font-weight:bold;">GST (10%)</td>
                  <td style="padding:10px;font-size:13px;color:#333333;text-align:right;">${formatCurrency(gst)}</td>
                </tr>
                <tr style="background-color:#0D7377;">
                  <td colspan="3" style="padding:10px;font-size:14px;color:#ffffff;text-align:right;font-weight:bold;">TOTAL DUE (AUD)</td>
                  <td style="padding:10px;font-size:14px;color:#ffffff;text-align:right;font-weight:bold;">${formatCurrency(totalDue)}</td>
                </tr>
              </table>`
                  : ''
              }

              <!-- Shipping address -->
              <h3 style="margin:0 0 10px 0;font-size:15px;color:#0D7377;">Shipping Address</h3>
              <p style="margin:0 0 28px 0;font-size:14px;color:#333333;line-height:1.6;">
                ${addressBlock(shippingAddress)}
              </p>

              <!-- Invoice attachment notice -->
              <div style="background-color:#f0faf0;border-left:4px solid #76B900;padding:14px 18px;margin-bottom:28px;border-radius:0 4px 4px 0;">
                <p style="margin:0;font-size:14px;color:#333333;">
                  <strong>Your invoice is attached to this email.</strong><br>
                  Please save a copy for your records. Reference <strong>${invoiceNumber}</strong> for all correspondence.
                </p>
              </div>
            </td>
          </tr>

          <!-- ==================== FOOTER ==================== -->
          <tr>
            <td style="background-color:#f7f7f7;padding:20px 36px;border-top:1px solid #e8e8e8;">
              <p style="margin:0;font-size:12px;color:#888888;text-align:center;line-height:1.8;">
                Questions? <a href="mailto:billing@tensorworks.online" style="color:#0D7377;text-decoration:none;">billing@tensorworks.online</a>
                &nbsp;|&nbsp;
                <a href="https://tensorworks.online" style="color:#0D7377;text-decoration:none;">tensorworks.online</a><br>
                ABN: 84 544 119 830 &nbsp;|&nbsp; TensorWorks — AI Hardware Solutions
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// sendInvoice — send email with PDF attachment; retries up to 3 times
// ---------------------------------------------------------------------------
async function sendInvoice(orderData, invoiceNumber, filePath) {
  const ts = new Date().toISOString();
  const toEmail = orderData.email;

  if (!toEmail) {
    throw new Error('No recipient email address in orderData');
  }

  // Read PDF as base64
  const pdfBuffer = fs.readFileSync(filePath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const msg = {
    to: toEmail,
    from: FROM_EMAIL,
    subject: `Order Confirmation — Invoice INV-${invoiceNumber}`,
    html: buildHtml(orderData, invoiceNumber),
    attachments: [
      {
        content: pdfBase64,
        filename: `Invoice_INV-${invoiceNumber}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  };

  // Retry with exponential backoff: 1s, 2s, 4s
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [1000, 2000, 4000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await sgMail.send(msg);
      console.log(
        `[${new Date().toISOString()}] EMAIL_SUCCESS invoiceNumber=${invoiceNumber} to=${toEmail} attempt=${attempt}`
      );
      return; // success
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      console.error(
        `[${new Date().toISOString()}] EMAIL_FAILED invoiceNumber=${invoiceNumber} to=${toEmail} attempt=${attempt}/${MAX_ATTEMPTS} error="${err.message}"`
      );

      if (isLastAttempt) {
        throw err;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1]));
    }
  }
}

module.exports = { sendInvoice };
