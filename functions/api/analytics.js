/**
 * Analytics — session beacon collector and stats summariser.
 * POST: append a session beacon. GET: return 7d/30d summary stats.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
const MAX_SESSIONS = 500;

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Analytics' },
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
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Analytics', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT failed'); }
  return r.json();
}
async function loadJSON(path, token, fallback = null) {
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g,''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

function sinceMs(days) { return Date.now() - days * 86400000; }

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return summary stats ─────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/analytics.json', token, { sessions: [] });
    const sessions = data?.sessions || [];

    const cutoff7 = sinceMs(7);
    const cutoff30 = sinceMs(30);
    const recent7 = sessions.filter(s => new Date(s.timestamp).getTime() >= cutoff7);
    const recent30 = sessions.filter(s => new Date(s.timestamp).getTime() >= cutoff30);

    const productViews7 = {}, productViews30 = {};
    const pageViews7 = {}, pageViews30 = {};

    for (const s of recent7) {
      (s.productViews || []).forEach(h => { productViews7[h] = (productViews7[h] || 0) + 1; });
      (s.pageViews || []).forEach(p => { pageViews7[p] = (pageViews7[p] || 0) + 1; });
    }
    for (const s of recent30) {
      (s.productViews || []).forEach(h => { productViews30[h] = (productViews30[h] || 0) + 1; });
      (s.pageViews || []).forEach(p => { pageViews30[p] = (pageViews30[p] || 0) + 1; });
    }

    const topProducts = Object.entries(productViews7).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([handle, views]) => ({ handle, views }));
    const topPages = Object.entries(pageViews7).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([page, views]) => ({ page, views }));

    return jsonResponse({
      sessions7d: recent7.length,
      sessions30d: recent30.length,
      totalSessions: sessions.length,
      productViews7d: productViews7,
      productViews30d: productViews30,
      topProducts,
      topPages,
      recentSessions: sessions.slice(0, 20),
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── POST: append beacon ───────────────────────────────────────────────────
  const beacon = await request.json().catch(() => null);
  if (!beacon) return jsonResponse({ error: 'Invalid JSON' }, 400);

  const { data, sha } = await loadJSON('data/analytics.json', token, { sessions: [] });
  const sessions = data?.sessions || [];

  const session = {
    timestamp: new Date().toISOString(),
    sessionId: beacon.sessionId || null,
    page: beacon.page || null,
    referrer: beacon.referrer || null,
    duration: beacon.duration || null,
    productViews: beacon.productViews || [],
    pageViews: beacon.pageViews || [],
    device: beacon.device || null,
  };

  sessions.unshift(session);
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;

  await ghPut('data/analytics.json', JSON.stringify({ sessions }, null, 2), sha, 'Analytics: beacon', token);
  return jsonResponse({ success: true });
}
