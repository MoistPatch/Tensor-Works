const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Admin' }
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
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Admin', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT failed: ' + r.status); }
  return r.json();
}
async function loadJSON(path, token, fallback = null) {
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g,''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
function corsHeaders() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret' } });
}
function checkSecret(request, env) {
  if (!env.SYNC_SECRET) return true;
  const h = request.headers.get('X-Sync-Secret') || new URL(request.url).searchParams.get('secret');
  return h === env.SYNC_SECRET;
}

function deepSet(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

const BRAIN_PATH = 'data/brain.json';

const DEFAULT_BRAIN = {
  meta: {
    version: '1.0.0',
    lastUpdated: null,
    lastOrchestrationAt: null,
    totalRunCount: 0,
    notes: []
  },
  constraints: {
    minConfidenceToAutoApply: 0.75,
    maxPriceChangePercent: 15,
    requireHumanApprovalAbove: {
      priceChangeAUD: 500
    },
    frozenProducts: [],
    blacklistedActions: []
  },
  skills: {
    pricing: {
      learnedMarkups: {}
    },
    forecasting: {},
    anomalyDetection: {}
  },
  decisionLog: []
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return corsHeaders();

  if (!checkSecret(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const { data, sha } = await loadJSON(BRAIN_PATH, token, DEFAULT_BRAIN);
    return jsonResponse({ brain: data, sha });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { action } = body;
    const { data: brain, sha } = await loadJSON(BRAIN_PATH, token, structuredClone(DEFAULT_BRAIN));

    if (!brain) return jsonResponse({ error: 'Failed to load brain.json' }, 500);

    if (action === 'update') {
      const { path, value } = body;
      if (!path) return jsonResponse({ error: 'path is required' }, 400);
      deepSet(brain, path, value);
      brain.meta.lastUpdated = new Date().toISOString();
      await ghPut(BRAIN_PATH, JSON.stringify(brain, null, 2), sha, `brain: update ${path}`, token);
      return jsonResponse({ success: true, path, value });
    }

    if (action === 'log-decision') {
      const { decision } = body;
      if (!decision) return jsonResponse({ error: 'decision is required' }, 400);
      if (!Array.isArray(brain.decisionLog)) brain.decisionLog = [];
      brain.decisionLog.push(decision);
      if (brain.decisionLog.length > 200) {
        brain.decisionLog = brain.decisionLog.slice(-200);
      }
      brain.meta.lastUpdated = new Date().toISOString();
      await ghPut(BRAIN_PATH, JSON.stringify(brain, null, 2), sha, `brain: log decision ${decision.id || decision.type || 'unknown'}`, token);
      return jsonResponse({ success: true, logLength: brain.decisionLog.length });
    }

    if (action === 'update-constraints') {
      const { constraints } = body;
      if (!constraints) return jsonResponse({ error: 'constraints is required' }, 400);
      brain.constraints = Object.assign({}, brain.constraints, constraints);
      brain.meta.lastUpdated = new Date().toISOString();
      await ghPut(BRAIN_PATH, JSON.stringify(brain, null, 2), sha, 'brain: update constraints', token);
      return jsonResponse({ success: true, constraints: brain.constraints });
    }

    if (action === 'add-note') {
      const { note } = body;
      if (typeof note !== 'string') return jsonResponse({ error: 'note must be a string' }, 400);
      if (!Array.isArray(brain.meta.notes)) brain.meta.notes = [];
      brain.meta.notes.push(note);
      if (brain.meta.notes.length > 50) {
        brain.meta.notes = brain.meta.notes.slice(-50);
      }
      brain.meta.lastUpdated = new Date().toISOString();
      await ghPut(BRAIN_PATH, JSON.stringify(brain, null, 2), sha, 'brain: add note', token);
      return jsonResponse({ success: true, notesCount: brain.meta.notes.length });
    }

    return jsonResponse({ error: 'Unknown action: ' + action }, 400);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
