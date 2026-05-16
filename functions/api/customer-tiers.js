/**
 * Customer Tiers — B2B customer tier pricing.
 * GET: return all tiers (seeding defaults on first load).
 * POST actions: price-lookup, create, update, delete.
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

const DATA_PATH = 'data/customer-tiers.json';

const DEFAULT_TIERS = {
  tiers: [
    { id: 'retail', name: 'Retail', discountPct: 0, minOrderValueAUD: 0, requiresApproval: false, color: '#6b7280', description: 'Standard retail pricing' },
    { id: 'reseller', name: 'Reseller', discountPct: 15, minOrderValueAUD: 5000, requiresApproval: true, color: '#0d7377', description: 'Authorised reseller pricing' },
    { id: 'government', name: 'Government', discountPct: 10, minOrderValueAUD: 0, requiresApproval: true, color: '#1d4ed8', description: 'Government and education pricing' },
    { id: 'enterprise', name: 'Enterprise', discountPct: 20, minOrderValueAUD: 20000, requiresApproval: true, color: '#7c3aed', description: 'Enterprise account pricing' },
  ],
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    let { data, sha } = await loadJSON(DATA_PATH, token, null);
    if (!data) {
      // Seed defaults
      await ghPut(DATA_PATH, JSON.stringify(DEFAULT_TIERS, null, 2), null, 'Customer tiers: seed defaults', token);
      data = DEFAULT_TIERS;
    }
    return jsonResponse(data);
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // Load tiers (seeding if absent)
  let { data, sha } = await loadJSON(DATA_PATH, token, null);
  if (!data) {
    const put = await ghPut(DATA_PATH, JSON.stringify(DEFAULT_TIERS, null, 2), null, 'Customer tiers: seed defaults', token);
    data = DEFAULT_TIERS;
    sha = put.content.sha;
  }

  // ── action: price-lookup ─────────────────────────────────────────────────────
  if (action === 'price-lookup') {
    const { tierId, priceIncGst } = body;
    if (!tierId || priceIncGst === undefined) return jsonResponse({ error: 'tierId and priceIncGst required' }, 400);
    const tier = data.tiers.find(t => t.id === tierId);
    if (!tier) return jsonResponse({ error: 'Tier not found' }, 404);
    const adjustedPrice = Math.round(priceIncGst * (1 - tier.discountPct / 100) * 100) / 100;
    const savingAUD = Math.round((priceIncGst - adjustedPrice) * 100) / 100;
    return jsonResponse({ tierId, tierName: tier.name, originalPrice: priceIncGst, discountPct: tier.discountPct, adjustedPrice, savingAUD });
  }

  // ── action: create ───────────────────────────────────────────────────────────
  if (action === 'create') {
    const { id, name, discountPct, minOrderValueAUD, requiresApproval, color, description } = body;
    if (!id || !name || discountPct === undefined) return jsonResponse({ error: 'id, name, and discountPct are required' }, 400);
    if (typeof discountPct !== 'number' || discountPct < 0 || discountPct > 50) return jsonResponse({ error: 'discountPct must be a number between 0 and 50' }, 400);
    if (data.tiers.find(t => t.id === id)) return jsonResponse({ error: 'Tier id already exists' }, 409);
    const tier = { id, name, discountPct, minOrderValueAUD: minOrderValueAUD ?? 0, requiresApproval: requiresApproval ?? false, color: color ?? '#6b7280', description: description ?? '' };
    data.tiers.push(tier);
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Customer tiers: create ${id}`, token);
    return jsonResponse({ created: true, tier });
  }

  // ── action: update ───────────────────────────────────────────────────────────
  if (action === 'update') {
    const { id, ...fields } = body;
    if (!id) return jsonResponse({ error: 'id required' }, 400);
    const idx = data.tiers.findIndex(t => t.id === id);
    if (idx === -1) return jsonResponse({ error: 'Tier not found' }, 404);
    // Disallow changing the id field itself
    delete fields.action;
    delete fields.id;
    if (fields.discountPct !== undefined && (typeof fields.discountPct !== 'number' || fields.discountPct < 0 || fields.discountPct > 50)) {
      return jsonResponse({ error: 'discountPct must be a number between 0 and 50' }, 400);
    }
    data.tiers[idx] = { ...data.tiers[idx], ...fields };
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Customer tiers: update ${id}`, token);
    return jsonResponse({ updated: true, tier: data.tiers[idx] });
  }

  // ── action: delete ───────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = body;
    if (!id) return jsonResponse({ error: 'id required' }, 400);
    if (id === 'retail') return jsonResponse({ error: 'Cannot delete the retail tier — it is the default' }, 400);
    const before = data.tiers.length;
    data.tiers = data.tiers.filter(t => t.id !== id);
    if (data.tiers.length === before) return jsonResponse({ error: 'Tier not found' }, 404);
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Customer tiers: delete ${id}`, token);
    return jsonResponse({ deleted: true });
  }

  return jsonResponse({ error: 'Unknown action. Use: price-lookup | create | update | delete' }, 400);
}
