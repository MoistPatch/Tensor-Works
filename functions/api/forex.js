/**
 * Forex — tracks AUD/USD exchange rate, stores history, and alerts on >2% movement.
 * GET: returns current forex data from data/forex.json.
 * POST: fetches latest rate from open.er-api.com, updates history, emits alert if needed.
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

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  const FOREX_PATH = 'data/forex.json';
  const FALLBACK = { current: null, history: [], lastUpdated: null, alerts: [] };

  // ── GET: return current forex data ────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON(FOREX_PATH, token, FALLBACK);
    const history = data.history || [];
    const current = data.current;
    const now7 = history.length >= 7 ? history[history.length - 7] : null;
    const change7d = (current !== null && now7) ? +(current - now7.audUsd).toFixed(6) : null;
    const alert = (change7d !== null && Math.abs(change7d) > 0.02) ? {
      type: 'forex-movement',
      audUsd: current,
      change7d,
      impact: change7d < 0 ? 'USD-priced imports cost more in AUD' : 'USD-priced imports cheaper in AUD',
    } : null;
    return jsonResponse({ current, history: history.slice(-7), change7d, lastUpdated: data.lastUpdated, alert });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── POST: fetch rate, update history, alert if needed ────────────────────
  const { data: forex, sha } = await loadJSON(FOREX_PATH, token, FALLBACK);
  forex.history = forex.history || [];
  forex.alerts = forex.alerts || [];

  // Skip if updated less than 20 hours ago
  if (forex.lastUpdated) {
    const hoursSince = (Date.now() - new Date(forex.lastUpdated).getTime()) / 36e5;
    if (hoursSince < 20) return jsonResponse({ ...forex, skipped: true });
  }

  // Fetch AUD/USD from open.er-api.com (USD base → AUD rate)
  const erRes = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!erRes.ok) return jsonResponse({ error: 'Exchange rate fetch failed: ' + erRes.status }, 502);
  const erData = await erRes.json();
  const audPerUsd = erData.rates && erData.rates.AUD;
  if (!audPerUsd) return jsonResponse({ error: 'AUD rate not found in response' }, 502);
  const rate = +(1 / audPerUsd).toFixed(6); // AUD/USD

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const entry = { date: dateStr, audUsd: rate, timestamp: now.toISOString() };

  forex.history.push(entry);
  if (forex.history.length > 365) forex.history = forex.history.slice(-365);

  // change24h: compare to yesterday's entry
  const yesterday = forex.history.length >= 2 ? forex.history[forex.history.length - 2] : null;
  const change24h = yesterday ? +(rate - yesterday.audUsd).toFixed(6) : null;

  // change7d: compare to 7 entries ago
  const week = forex.history.length >= 7 ? forex.history[forex.history.length - 7] : null;
  const change7d = week ? +(rate - week.audUsd).toFixed(6) : null;

  let alertCreated = null;
  if (change7d !== null && Math.abs(change7d) > 0.02) {
    alertCreated = {
      type: 'forex-movement',
      audUsd: rate,
      change7d,
      impact: change7d < 0 ? 'USD-priced imports cost more in AUD' : 'USD-priced imports cheaper in AUD',
      detectedAt: now.toISOString(),
    };
    forex.alerts.push(alertCreated);
    if (forex.alerts.length > 20) forex.alerts = forex.alerts.slice(-20);
  }

  forex.current = rate;
  forex.lastUpdated = now.toISOString();

  await ghPut(FOREX_PATH, JSON.stringify(forex, null, 2), sha, 'Forex: update AUD/USD rate ' + dateStr, token);

  return jsonResponse({ audUsd: rate, change24h, change7d, alert: alertCreated });
}
