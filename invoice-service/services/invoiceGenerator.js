const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const database = require('./database');

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------
const BRAND = {
  TEAL:       '#0D7377',
  TEAL_LIGHT: '#14a8ae',
  GREEN:      '#76B900',
  DARK_TEXT:  '#333333',
  MID_TEXT:   '#555555',
  LIGHT_TEXT: '#666666',
  MUTED:      '#888888',
  ROW_ALT:    '#F7F7F7',
  WHITE:      '#FFFFFF',
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Column widths for line-item table
// ---------------------------------------------------------------------------
const COL = {
  DESC:       250,
  QTY:         50,
  UNIT_PRICE:  90,
  TAX:         70,
  TOTAL:       90,
};

// ---------------------------------------------------------------------------
// generate(orderData) → { invoiceNumber, filePath }
// ---------------------------------------------------------------------------
async function generate(orderData) {
  const invoiceSeq = await database.getNextInvoiceNumber();
  const invoiceNumber = `INV-${invoiceSeq}`;
  const invoiceDir = path.resolve('./invoices');
  fs.mkdirSync(invoiceDir, { recursive: true });
  const filePath = path.join(invoiceDir, `invoice_${invoiceNumber}.pdf`);

  await new Promise((resolve, reject) => {
    try {
      buildPDF(orderData, invoiceNumber, filePath, resolve, reject);
    } catch (err) {
      reject(err);
    }
  });

  return { invoiceNumber, filePath };
}

// ---------------------------------------------------------------------------
// buildPDF — constructs the PDF document
// ---------------------------------------------------------------------------
function buildPDF(orderData, invoiceNumber, filePath, resolve, reject) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  stream.on('finish', resolve);
  stream.on('error', reject);

  const now = new Date();
  const dueDate = addDays(now, 30);
  const { items = [], billingAddress = {}, shippingAddress = {}, email } = orderData;

  // =========================================================================
  // HEADER
  // =========================================================================
  const headerY = MARGIN;

  // Left side — company identity
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(BRAND.TEAL)
    .text('TENSORWORKS', MARGIN, headerY);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(BRAND.LIGHT_TEXT)
    .text('AI Hardware Solutions | Custom Builds | OEM/ODM Services', MARGIN, headerY + 34);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(BRAND.TEAL_LIGHT)
    .text('tensorworks.online', MARGIN, headerY + 48);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(BRAND.MID_TEXT)
    .text('ABN: 84 544 119 830  |  sales@tensorworks.online', MARGIN, headerY + 62);

  // Right side — invoice identity
  const rightX = PAGE_WIDTH - MARGIN;

  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(BRAND.TEAL)
    .text('INVOICE', MARGIN, headerY, { width: CONTENT_WIDTH, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(BRAND.DARK_TEXT)
    .text(`Invoice #: ${invoiceNumber}`, MARGIN, headerY + 34, { width: CONTENT_WIDTH, align: 'right' })
    .text(`Date: ${formatDate(now)}`, MARGIN, headerY + 50, { width: CONTENT_WIDTH, align: 'right' })
    .text(`Due: Net 30 (${formatDate(dueDate)})`, MARGIN, headerY + 66, { width: CONTENT_WIDTH, align: 'right' });

  // =========================================================================
  // DIVIDER
  // =========================================================================
  const dividerY = headerY + 90;
  doc
    .moveTo(MARGIN, dividerY)
    .lineTo(PAGE_WIDTH - MARGIN, dividerY)
    .lineWidth(1)
    .strokeColor(BRAND.TEAL)
    .stroke();

  // =========================================================================
  // BILL TO / SHIP TO
  // =========================================================================
  const addrY = dividerY + 16;
  const halfWidth = CONTENT_WIDTH / 2 - 10;

  // BILL TO label
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(BRAND.TEAL)
    .text('BILL TO', MARGIN, addrY);

  // Billing address lines
  const billLines = addressLines(billingAddress);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(BRAND.DARK_TEXT)
    .text(billLines.join('\n'), MARGIN, addrY + 14, { width: halfWidth });

  // SHIP TO label
  const shipX = MARGIN + halfWidth + 20;

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(BRAND.TEAL)
    .text('SHIP TO', shipX, addrY);

  const shipLines = addressLines(shippingAddress);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(BRAND.DARK_TEXT)
    .text(shipLines.join('\n'), shipX, addrY + 14, { width: halfWidth });

  // Estimate address block height (approx 14pt per line)
  const addrHeight = Math.max(billLines.length, shipLines.length) * 14 + 14;

  // =========================================================================
  // LINE ITEMS TABLE
  // =========================================================================
  const tableY = addrY + addrHeight + 20;

  // Table header row
  const tableHeaderHeight = 20;
  doc
    .rect(MARGIN, tableY, CONTENT_WIDTH, tableHeaderHeight)
    .fill(BRAND.TEAL);

  // Column header text
  let cx = MARGIN + 6;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.WHITE);

  doc.text('Description', cx, tableY + 5, { width: COL.DESC - 6, align: 'left' });
  cx += COL.DESC;
  doc.text('Qty', cx, tableY + 5, { width: COL.QTY, align: 'center' });
  cx += COL.QTY;
  doc.text('Unit Price', cx, tableY + 5, { width: COL.UNIT_PRICE, align: 'right' });
  cx += COL.UNIT_PRICE;
  doc.text('Tax (10%)', cx, tableY + 5, { width: COL.TAX, align: 'right' });
  cx += COL.TAX;
  doc.text('Total', cx, tableY + 5, { width: COL.TOTAL - 6, align: 'right' });

  // Data rows
  let currentY = tableY + tableHeaderHeight;
  let subtotal = 0;

  items.forEach((item, idx) => {
    const qty = item.qty || item.quantity || 1;
    const unitPrice = item.unit_price || item.price || 0;
    const itemSubtotal = unitPrice * qty;
    const itemTax = itemSubtotal * 0.1;
    const itemTotal = itemSubtotal * 1.1;
    subtotal += itemSubtotal;

    // Measure text height for description wrapping
    const descHeight = doc.heightOfString(item.description || item.name || '', {
      width: COL.DESC - 12,
      font: 'Helvetica',
      size: 9,
    });
    const rowHeight = Math.max(descHeight + 10, 22);

    // Row background (alternating)
    const rowBg = idx % 2 === 0 ? BRAND.WHITE : BRAND.ROW_ALT;
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight).fill(rowBg);

    doc.font('Helvetica').fontSize(9).fillColor(BRAND.DARK_TEXT);

    let rx = MARGIN + 6;
    doc.text(item.description || item.name || '', rx, currentY + 5, {
      width: COL.DESC - 12,
      align: 'left',
    });
    rx += COL.DESC;
    doc.text(String(qty), rx, currentY + 5, { width: COL.QTY, align: 'center' });
    rx += COL.QTY;
    doc.text(formatCurrency(unitPrice), rx, currentY + 5, { width: COL.UNIT_PRICE, align: 'right' });
    rx += COL.UNIT_PRICE;
    doc.text(formatCurrency(itemTax), rx, currentY + 5, { width: COL.TAX, align: 'right' });
    rx += COL.TAX;
    doc.text(formatCurrency(itemTotal), rx, currentY + 5, { width: COL.TOTAL - 6, align: 'right' });

    currentY += rowHeight;
  });

  // =========================================================================
  // TOTALS BLOCK (right-aligned)
  // =========================================================================
  const gst = subtotal * 0.1;
  const totalDue = subtotal * 1.1;

  const totalsX = MARGIN + CONTENT_WIDTH - 260;
  const totalsWidth = 260;
  const totalsRowH = 22;

  currentY += 12;

  // Subtotal row
  doc
    .rect(totalsX, currentY, totalsWidth, totalsRowH)
    .fill(BRAND.ROW_ALT);
  doc.font('Helvetica').fontSize(10).fillColor(BRAND.DARK_TEXT);
  doc.text('Subtotal (excl. GST)', totalsX + 6, currentY + 6, { width: 170, align: 'left' });
  doc.text(formatCurrency(subtotal), totalsX + 6, currentY + 6, { width: totalsWidth - 12, align: 'right' });
  currentY += totalsRowH;

  // GST row
  doc
    .rect(totalsX, currentY, totalsWidth, totalsRowH)
    .fill(BRAND.WHITE);
  doc.font('Helvetica').fontSize(10).fillColor(BRAND.DARK_TEXT);
  doc.text('GST (10%)', totalsX + 6, currentY + 6, { width: 170, align: 'left' });
  doc.text(formatCurrency(gst), totalsX + 6, currentY + 6, { width: totalsWidth - 12, align: 'right' });
  currentY += totalsRowH;

  // TOTAL DUE row
  doc
    .rect(totalsX, currentY, totalsWidth, totalsRowH + 2)
    .fill(BRAND.TEAL);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.WHITE);
  doc.text('TOTAL DUE', totalsX + 6, currentY + 6, { width: 170, align: 'left' });
  doc.text(formatCurrency(totalDue), totalsX + 6, currentY + 6, { width: totalsWidth - 12, align: 'right' });
  currentY += totalsRowH + 2;

  // =========================================================================
  // FOOTER
  // =========================================================================
  const footerY = currentY + 40;

  // Thin divider
  doc
    .moveTo(MARGIN, footerY)
    .lineTo(PAGE_WIDTH - MARGIN, footerY)
    .lineWidth(0.5)
    .strokeColor(BRAND.LIGHT_TEXT)
    .stroke();

  doc.font('Helvetica').fontSize(9).fillColor(BRAND.DARK_TEXT);
  doc.text(`Payment Terms: Net 30 from invoice date`, MARGIN, footerY + 10);
  doc.text(
    `Bank transfer details provided on request. Reference: ${invoiceNumber}`,
    MARGIN,
    footerY + 24
  );
  doc
    .font('Helvetica-Oblique')
    .text(
      'This invoice relates to the custom-built system specified in your accepted quote.',
      MARGIN,
      footerY + 38
    );
  doc
    .font('Helvetica')
    .text(
      'Questions? billing@tensorworks.online  |  tensorworks.online',
      MARGIN,
      footerY + 52
    );

  // Bottom credit line — centered
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(BRAND.MUTED)
    .text(
      'TensorWorks — AI Hardware Solutions  |  ABN: 84 544 119 830',
      MARGIN,
      footerY + 70,
      { width: CONTENT_WIDTH, align: 'center' }
    );

  doc.end();
}

// ---------------------------------------------------------------------------
// addressLines — flatten an address object into an array of strings
// ---------------------------------------------------------------------------
function addressLines(addr) {
  if (!addr || typeof addr !== 'object') return ['—'];
  const lines = [];
  if (addr.company) lines.push(addr.company);
  if (addr.name) lines.push(addr.name);
  if (addr.line1) lines.push(addr.line1);
  if (addr.line2) lines.push(addr.line2);
  const cityState = [addr.city, addr.state].filter(Boolean).join(', ');
  if (cityState) lines.push(cityState);
  const postCountry = [addr.postal_code, addr.country].filter(Boolean).join(' ');
  if (postCountry) lines.push(postCountry);
  if (addr.phone) lines.push(addr.phone);
  return lines.length ? lines : ['—'];
}

module.exports = { generate };
