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

const BRAIN_PATH = 'data/brain.json';

async function runStep(name, fn) {
  try {
    const result = await fn();
    return { name, status: 'ok', result };
  } catch (err) {
    return { name, status: 'error', error: err.message };
  }
}

async function callAgent(baseUrl, path, syncSecret) {
  const url = baseUrl.replace(/\/$/, '') + path;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Secret': syncSecret || ''
    },
    body: JSON.stringify({ trigger: 'orchestrator' })
  });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text.slice(0, 500) }; }
  if (!r.ok) throw new Error(`${path} returned ${r.status}: ${JSON.stringify(parsed)}`);
  return parsed;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return corsHeaders();

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const { data: brain } = await loadJSON(BRAIN_PATH, token, null);
    if (!brain) return jsonResponse({ error: 'brain.json not found' }, 404);
    return jsonResponse({
      lastOrchestrationAt: brain.meta?.lastOrchestrationAt || null,
      totalRunCount: brain.meta?.totalRunCount || 0,
      lastUpdated: brain.meta?.lastUpdated || null
    });
  }

  if (request.method === 'POST') {
    if (!checkSecret(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const startTime = Date.now();
    const requestUrl = new URL(request.url);
    const baseUrl = requestUrl.origin;
    const syncSecret = env.SYNC_SECRET || '';

    // Load brain to get current state
    const { data: brain, sha: brainSha } = await loadJSON(BRAIN_PATH, token, {
      meta: { totalRunCount: 0, lastOrchestrationAt: null, lastUpdated: null, notes: [] },
      constraints: {},
      skills: {},
      decisionLog: []
    });

    const steps = [];

    // Step 1: Competitor crawl
    steps.push(await runStep('competitor-crawl', () =>
      callAgent(baseUrl, '/api/competitor-crawl', syncSecret)
    ));

    // Step 2: Dicker Data sync
    steps.push(await runStep('dicker-sync', () =>
      callAgent(baseUrl, '/api/dicker-sync', syncSecret)
    ));

    // Step 3: Trend analysis
    steps.push(await runStep('trend-analyst', () =>
      callAgent(baseUrl, '/api/trend-analyst', syncSecret)
    ));

    // Step 4: Anomaly detection
    steps.push(await runStep('anomaly-detector', () =>
      callAgent(baseUrl, '/api/anomaly-detector', syncSecret)
    ));

    // Step 5: Intelligence analysis
    steps.push(await runStep('intelligence', () =>
      callAgent(baseUrl, '/api/intelligence', syncSecret)
    ));

    // Step 6: Memory manager
    steps.push(await runStep('memory-manager', () =>
      callAgent(baseUrl, '/api/memory-manager', syncSecret)
    ));

    // Step 7: Update brain meta
    const updateStep = await runStep('brain-update', async () => {
      const runCount = (brain.meta?.totalRunCount || 0) + 1;
      const now = new Date().toISOString();
      brain.meta = brain.meta || {};
      brain.meta.totalRunCount = runCount;
      brain.meta.lastOrchestrationAt = now;
      brain.meta.lastUpdated = now;

      await ghPut(
        BRAIN_PATH,
        JSON.stringify(brain, null, 2),
        brainSha,
        `orchestrator: run #${runCount} at ${now}`,
        token
      );

      return { totalRunCount: runCount, lastOrchestrationAt: now };
    });
    steps.push(updateStep);

    const duration = Date.now() - startTime;
    const allOk = steps.every(s => s.status === 'ok');

    return jsonResponse({
      success: allOk,
      steps,
      duration,
      completedAt: new Date().toISOString()
    });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
