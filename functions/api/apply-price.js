/**
 * Apply Price — update a product's price with margin validation and audit trail.
 * GET:  return audit log
 * POST: apply price change (requires reason; >10% change requires force:true)
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
const PRODUCTS_FILE = 'data/products.json';
const AUDIT_FILE = 'data/pricing-audit.json';
const BIG_CHANGE_THRESHOLD = 0.10; // 10%

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks' },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}
async function ghPut(path, content, sha, message, token) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT failed'); }
  return r.json();
}
async function loadJSON(path, token, fallback = null) {
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

function computeMarginPct(priceIncGst, costExGst) {
  if (!priceIncGst || !costExGst) return null;
  const priceExGst = priceIncGst / 1.1;
  return (priceExGst - costExGst) / priceExGst;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }});
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // GET: return audit log
  if (request.method === 'GET') {
    const { data } = await loadJSON(AUDIT_FILE, token, { entries: [] });
    return jsonResponse({ auditLog: (data?.entries || []).slice(0, 100) });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { sku, newPrice, reason, force = false } = body;

  if (!sku) return jsonResponse({ error: 'sku is required' }, 400);
  if (!newPrice || newPrice <= 0) return jsonResponse({ error: 'newPrice must be a positive number' }, 400);
  if (!reason?.trim()) return jsonResponse({ error: 'reason is required for audit trail' }, 400);

  // Load products
  const { data: products, sha: productsSha } = await loadJSON(PRODUCTS_FILE, token, []);
  const productList = Array.isArray(products) ? products : [];

  const productIdx = productList.findIndex(p => p.handle === sku || p.sku === sku);
  if (productIdx === -1) return jsonResponse({ error: `Product not found: ${sku}` }, 404);

  const product = productList[productIdx];
  const oldPrice = product.priceIncGst || product.price || 0;
  const costExGst = product.costExGst || 0;

  // Check 10% threshold
  const changePct = oldPrice > 0 ? Math.abs((newPrice - oldPrice) / oldPrice) : 0;
  if (changePct > BIG_CHANGE_THRESHOLD && !force) {
    return jsonResponse({
      requiresApproval: true,
      error: `Price change of ${Math.round(changePct * 100)}% exceeds 10% threshold. Pass force:true to override.`,
      changePct: Math.round(changePct * 100),
      oldPrice,
      newPrice,
    }, 200);
  }

  // Compute margins
  const oldMarginPct = computeMarginPct(oldPrice, costExGst);
  const newMarginPct = computeMarginPct(newPrice, costExGst);

  // Update product
  productList[productIdx] = { ...product, priceIncGst: newPrice };

  // Build audit entry
  const auditId = 'pa-' + Date.now();
  const auditEntry = {
    auditId,
    sku,
    productTitle: product.title || sku,
    oldPrice,
    newPrice,
    changePct: Math.round(changePct * 10000) / 100,
    reason: reason.trim(),
    marginOld: oldMarginPct != null ? Math.round(oldMarginPct * 10000) / 100 : null,
    marginPct: newMarginPct != null ? Math.round(newMarginPct * 10000) / 100 : null,
    approvalStatus: force && changePct > BIG_CHANGE_THRESHOLD ? 'force-approved' : 'auto-approved',
    changedAt: new Date().toISOString(),
  };

  // Load audit log
  const { data: auditData, sha: auditSha } = await loadJSON(AUDIT_FILE, token, { entries: [] });
  const entries = [auditEntry, ...(auditData?.entries || [])].slice(0, 500);

  // Commit both files (products first, then audit)
  await ghPut(PRODUCTS_FILE, JSON.stringify(productList, null, 2), productsSha,
    `Pricing: ${sku} ${oldPrice} → ${newPrice} (${reason.slice(0, 50)})`, token);

  await ghPut(AUDIT_FILE, JSON.stringify({ entries }, null, 2), auditSha,
    `Pricing audit: ${sku} — ${auditId}`, token);

  return jsonResponse({
    success: true,
    auditId,
    sku,
    oldPrice,
    newPrice,
    changePct: auditEntry.changePct,
    marginOld: auditEntry.marginOld,
    marginPct: auditEntry.marginPct,
    approvalStatus: auditEntry.approvalStatus,
  });
}
