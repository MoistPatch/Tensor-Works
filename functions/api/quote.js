/**
 * Quote/RFQ — B2B quote workflow for enterprise hardware buyers.
 * GET: list/filter quotes. POST actions: create, update, send, update-status, add-note, delete.
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

function computeTotals(products) {
  const subtotalAUD = (products || []).reduce((sum, p) => sum + (p.qty || 0) * (p.unitPriceAUD || 0), 0);
  const gstAUD = Math.round(subtotalAUD * 0.1 * 100) / 100;
  const totalAUD = Math.round((subtotalAUD + gstAUD) * 100) / 100;
  return { subtotalAUD: Math.round(subtotalAUD * 100) / 100, gstAUD, totalAUD };
}

function byStatusCounts(quotes) {
  const counts = { draft: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0, expired: 0 };
  for (const q of quotes) counts[q.status] = (counts[q.status] || 0) + 1;
  return counts;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data, sha } = await loadJSON('data/quotes.json', token, { quotes: [], nextRef: 1 });
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const idFilter = url.searchParams.get('id');

    let quotes = data.quotes || [];

    if (idFilter) {
      const q = quotes.find(q => String(q.id) === String(idFilter));
      if (!q) return jsonResponse({ error: 'Quote not found' }, 404);
      return jsonResponse({ quote: q });
    }

    if (statusFilter) quotes = quotes.filter(q => q.status === statusFilter);

    return jsonResponse({ quotes, total: quotes.length, byStatus: byStatusCounts(data.quotes || []) });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  const { data, sha } = await loadJSON('data/quotes.json', token, { quotes: [], nextRef: 1 });
  const store = data || { quotes: [], nextRef: 1 };
  store.quotes = store.quotes || [];
  store.nextRef = store.nextRef || 1;

  // ── action: create ────────────────────────────────────────────────────────
  if (action === 'create') {
    const { customerName, email, company, phone = null, products = [], validDays = 30, notes = '', customerMessage = '', tierId = null } = body;
    if (!customerName) return jsonResponse({ error: 'customerName is required' }, 400);
    if (!email) return jsonResponse({ error: 'email is required' }, 400);

    const { subtotalAUD, gstAUD, totalAUD } = computeTotals(products);
    const reference = 'QUO-' + String(store.nextRef).padStart(4, '0');
    store.nextRef += 1;

    const quote = {
      id: Date.now(),
      reference,
      customerName,
      email,
      company: company || '',
      phone,
      products,
      subtotalAUD,
      gstAUD,
      totalAUD,
      status: 'draft',
      validDays,
      notes,
      customerMessage,
      tierId: tierId || null,
      createdAt: new Date().toISOString(),
      sentAt: null,
      viewedAt: null,
      expiresAt: null,
      respondedAt: null,
    };

    store.quotes.unshift(quote);
    if (store.quotes.length > 500) store.quotes = store.quotes.slice(0, 500);

    await ghPut('data/quotes.json', JSON.stringify(store, null, 2), sha, `Quote: create ${reference}`, token);
    return jsonResponse({ created: true, quote });
  }

  // ── action: update ────────────────────────────────────────────────────────
  if (action === 'update') {
    const { id, ...fields } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    const idx = store.quotes.findIndex(q => String(q.id) === String(id));
    if (idx === -1) return jsonResponse({ error: 'Quote not found' }, 404);

    const quote = { ...store.quotes[idx] };
    const immutable = new Set(['id', 'reference', 'createdAt', 'action']);
    for (const [k, v] of Object.entries(fields)) {
      if (!immutable.has(k)) quote[k] = v;
    }

    if (fields.products) {
      const { subtotalAUD, gstAUD, totalAUD } = computeTotals(quote.products);
      quote.subtotalAUD = subtotalAUD;
      quote.gstAUD = gstAUD;
      quote.totalAUD = totalAUD;
    }

    store.quotes[idx] = quote;
    await ghPut('data/quotes.json', JSON.stringify(store, null, 2), sha, `Quote: update ${quote.reference}`, token);
    return jsonResponse({ updated: true, quote });
  }

  // ── action: send ──────────────────────────────────────────────────────────
  if (action === 'send') {
    const { id } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    const idx = store.quotes.findIndex(q => String(q.id) === String(id));
    if (idx === -1) return jsonResponse({ error: 'Quote not found' }, 404);

    const quote = { ...store.quotes[idx] };
    const now = new Date();
    quote.status = 'sent';
    quote.sentAt = now.toISOString();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (quote.validDays || 30));
    quote.expiresAt = expiresAt.toISOString();

    store.quotes[idx] = quote;
    await ghPut('data/quotes.json', JSON.stringify(store, null, 2), sha, `Quote: send ${quote.reference}`, token);

    // Klaviyo event — non-fatal
    if (env.KLAVIYO_API_KEY && quote.email) {
      fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.KLAVIYO_API_KEY, 'Content-Type': 'application/json', 'revision': '2023-12-15' },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              profile: { data: { type: 'profile', attributes: { email: quote.email } } },
              metric: { data: { type: 'metric', attributes: { name: 'Quote Sent' } } },
              properties: { reference: quote.reference, totalAUD: quote.totalAUD, validDays: quote.validDays },
            },
          },
        }),
      }).catch(() => {});
    }

    // Resend email notification — non-fatal
    if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.ALERT_EMAIL,
          to: [env.ALERT_EMAIL],
          subject: `Quote ${quote.reference} sent to ${quote.email}`,
          text: `Quote ${quote.reference} has been sent to ${quote.email} (${quote.customerName}, ${quote.company}).`,
        }),
      }).catch(() => {});
    }

    return jsonResponse({ sent: true, quote });
  }

  // ── action: update-status ─────────────────────────────────────────────────
  if (action === 'update-status') {
    const { id, status } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);
    const allowed = new Set(['viewed', 'accepted', 'rejected', 'expired']);
    if (!allowed.has(status)) return jsonResponse({ error: 'status must be one of: viewed, accepted, rejected, expired' }, 400);

    const idx = store.quotes.findIndex(q => String(q.id) === String(id));
    if (idx === -1) return jsonResponse({ error: 'Quote not found' }, 404);

    const quote = { ...store.quotes[idx] };
    quote.status = status;
    const now = new Date().toISOString();
    if (status === 'viewed' && !quote.viewedAt) quote.viewedAt = now;
    if (status === 'accepted' || status === 'rejected') quote.respondedAt = now;

    store.quotes[idx] = quote;
    await ghPut('data/quotes.json', JSON.stringify(store, null, 2), sha, `Quote: status → ${status} for ${quote.reference}`, token);
    return jsonResponse({ updated: true });
  }

  // ── action: add-note ──────────────────────────────────────────────────────
  if (action === 'add-note') {
    const { id, note } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);
    if (!note) return jsonResponse({ error: 'note is required' }, 400);

    const idx = store.quotes.findIndex(q => String(q.id) === String(id));
    if (idx === -1) return jsonResponse({ error: 'Quote not found' }, 404);

    const quote = { ...store.quotes[idx] };
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const prefix = `[${ts}] `;
    quote.notes = quote.notes ? quote.notes + '\n' + prefix + note : prefix + note;

    store.quotes[idx] = quote;
    await ghPut('data/quotes.json', JSON.stringify(store, null, 2), sha, `Quote: add note to ${quote.reference}`, token);
    return jsonResponse({ updated: true });
  }

  // ── action: delete ────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);

    const idx = store.quotes.findIndex(q => String(q.id) === String(id));
    if (idx === -1) return jsonResponse({ error: 'Quote not found' }, 404);

    const quote = store.quotes[idx];
    if (quote.status !== 'draft') return jsonResponse({ error: 'Only draft quotes can be deleted' }, 400);

    store.quotes.splice(idx, 1);
    await ghPut('data/quotes.json', JSON.stringify(store, null, 2), sha, `Quote: delete ${quote.reference}`, token);
    return jsonResponse({ deleted: true });
  }

  return jsonResponse({ error: 'Unknown action. Use: create | update | send | update-status | add-note | delete' }, 400);
}
