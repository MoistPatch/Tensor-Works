/**
 * Brain — central knowledge store for the AI agent ecosystem.
 * GET: read brain.json. POST actions: update, log-decision, update-constraints, add-note.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Brain' },
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
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Brain', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT failed'); }
  return r.json();
}
async function loadBrain(token) {
  try {
    const f = await ghGet('data/brain.json', token);
    return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha };
  } catch (_) { return { data: null, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

// Deep-set a dot-notation path on an object
function deepSet(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const { data, sha } = await loadBrain(token);
    if (!data) return jsonResponse({ error: 'brain.json not found' }, 404);
    return jsonResponse(data);
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  const { data: brain, sha } = await loadBrain(token);
  if (!brain) return jsonResponse({ error: 'brain.json not found' }, 404);

  // ── action: update — deep-set a dot-notation path ─────────────────────────
  if (action === 'update') {
    if (!body.path || body.value === undefined) return jsonResponse({ error: 'path and value required' }, 400);
    deepSet(brain, body.path, body.value);
    brain.lastUpdated = new Date().toISOString();
    brain.meta = brain.meta || {};
    brain.meta.totalRunCount = (brain.meta.totalRunCount || 0) + 1;
    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), sha, `Brain update: ${body.path}`, token);
    return jsonResponse({ success: true, path: body.path });
  }

  // ── action: log-decision ──────────────────────────────────────────────────
  if (action === 'log-decision') {
    if (!body.decision) return jsonResponse({ error: 'decision object required' }, 400);
    brain.decisionLog = brain.decisionLog || [];
    brain.decisionLog.unshift({ ...body.decision, timestamp: new Date().toISOString() });
    if (brain.decisionLog.length > 200) brain.decisionLog = brain.decisionLog.slice(0, 200);
    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), sha, 'Brain: log decision', token);
    return jsonResponse({ success: true });
  }

  // ── action: update-constraints ────────────────────────────────────────────
  if (action === 'update-constraints') {
    if (!body.constraints || typeof body.constraints !== 'object') return jsonResponse({ error: 'constraints object required' }, 400);
    brain.constraints = { ...brain.constraints, ...body.constraints };
    brain.lastUpdated = new Date().toISOString();
    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), sha, 'Brain: update constraints', token);
    return jsonResponse({ success: true, constraints: brain.constraints });
  }

  // ── action: add-note ──────────────────────────────────────────────────────
  if (action === 'add-note') {
    if (!body.note) return jsonResponse({ error: 'note text required' }, 400);
    brain.meta = brain.meta || {};
    brain.meta.notes = brain.meta.notes || [];
    brain.meta.notes.unshift({ text: body.note, createdAt: new Date().toISOString() });
    if (brain.meta.notes.length > 50) brain.meta.notes = brain.meta.notes.slice(0, 50);
    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), sha, 'Brain: add note', token);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Unknown action. Use: update | log-decision | update-constraints | add-note' }, 400);
}
