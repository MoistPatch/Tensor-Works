/**
 * Order Webhook — Shopify order webhook → closed feedback loop.
 * Records actual sale outcomes against pending pricing recommendations,
 * then updates brain.json with real price elasticity data.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

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

async function verifyShopifyHmac(rawBody, secret, headerHmac) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === headerHmac;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Hmac-Sha256' } });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // Optionally verify Shopify HMAC
  const rawBody = await request.text();
  const webhookSecret = env.SHOPIFY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerHmac = request.headers.get('X-Shopify-Hmac-Sha256') || '';
    const valid = await verifyShopifyHmac(rawBody, webhookSecret, headerHmac);
    if (!valid) return jsonResponse({ error: 'HMAC verification failed' }, 401);
  }

  let order;
  try { order = JSON.parse(rawBody); } catch (_) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const orderId = order.id;
  const lineItems = order.line_items || [];

  // Load outcomes.json and brain.json in parallel
  const [outcomesResult, brainResult] = await Promise.all([
    loadJSON('data/outcomes.json', token, { orders: [] }),
    loadJSON('data/brain.json', token, {}),
  ]);

  const outcomes = outcomesResult.data;
  const outcomesSha = outcomesResult.sha;
  const brain = brainResult.data;
  const brainSha = brainResult.sha;

  const decisionLog = brain.decisionLog || [];
  const priceElasticityByCategory = (brain.patterns && brain.patterns.priceElasticityByCategory) || {};

  const newOutcomeRecords = [];

  for (const item of lineItems) {
    const sku = item.sku || '';
    const title = item.title || '';
    const salePriceAUD = parseFloat(item.price) || 0;
    const quantity = item.quantity || 1;

    const outcomeRecord = {
      orderId,
      sku,
      title,
      quantity,
      salePriceAUD,
      recordedAt: new Date().toISOString(),
    };

    // Try to find matching recommendation in decisionLog by SKU or title
    const matchingDecision = decisionLog.find(entry => {
      const entryStr = JSON.stringify(entry).toLowerCase();
      return (sku && entryStr.includes(sku.toLowerCase())) ||
             (title && entryStr.includes(title.toLowerCase()));
    });

    if (matchingDecision) {
      const recommendedPrice = matchingDecision.recommendedPrice ||
        matchingDecision.newPrice ||
        (matchingDecision.recommendation && matchingDecision.recommendation.recommendedPrice) ||
        null;
      if (recommendedPrice != null) {
        outcomeRecord.recommendedPrice = recommendedPrice;
        outcomeRecord.delta = salePriceAUD - recommendedPrice;
      }
    }

    newOutcomeRecords.push(outcomeRecord);

    // Update priceElasticityByCategory rolling average
    const category = item.product_type ||
      (matchingDecision && (matchingDecision.category || (matchingDecision.product && matchingDecision.product.category))) ||
      'uncategorized';

    const existing = priceElasticityByCategory[category] || { avgSalePrice: 0, sampleCount: 0 };
    const oldAvg = existing.avgSalePrice || 0;
    const oldCount = existing.sampleCount || 0;
    const newCount = oldCount + 1;
    const newAvg = (oldAvg * oldCount + salePriceAUD) / newCount;

    priceElasticityByCategory[category] = {
      avgSalePrice: newAvg,
      sampleCount: newCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Append outcome records and cap at 1000
  outcomes.orders = outcomes.orders || [];
  outcomes.orders.push(...newOutcomeRecords);
  if (outcomes.orders.length > 1000) outcomes.orders = outcomes.orders.slice(-1000);

  // Update brain priceElasticityByCategory
  brain.patterns = brain.patterns || {};
  brain.patterns.priceElasticityByCategory = priceElasticityByCategory;
  brain.lastUpdated = new Date().toISOString();

  // Write both files in parallel
  await Promise.all([
    ghPut('data/outcomes.json', JSON.stringify(outcomes, null, 2), outcomesSha, `Order webhook: record outcomes for order ${orderId}`, token),
    ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainSha, `Order webhook: update price elasticity for order ${orderId}`, token),
  ]);

  return jsonResponse({ recorded: newOutcomeRecords.length, orderId });
}
