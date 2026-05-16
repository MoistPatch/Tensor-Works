/**
 * Outcome — manual outcome tracker.
 * GET: summary of outcomes and experiments.
 * POST action=record: record whether a recommendation was applied and what happened.
 * POST action=summary: compute applied vs ignored stats and avg improvement.
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

  // ── GET: summary ─────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const [outcomesResult, experimentsResult] = await Promise.all([
      loadJSON('data/outcomes.json', token, { orders: [] }),
      loadJSON('data/experiments.json', token, { experiments: [] }),
    ]);

    const outcomes = outcomesResult.data;
    const experiments = experimentsResult.data;
    const orders = outcomes.orders || [];
    const recentOutcomes = orders.slice(-10).reverse();

    return jsonResponse({
      totalOrders: orders.length,
      recentOutcomes,
      experimentCount: (experiments.experiments || []).length,
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // ── action: record ────────────────────────────────────────────────────────────
  if (action === 'record') {
    const { recommendationId, applied, result } = body;
    if (recommendationId === undefined || applied === undefined) {
      return jsonResponse({ error: 'recommendationId and applied are required' }, 400);
    }

    const recordedAt = new Date().toISOString();

    // Load outcomes.json and brain.json in parallel
    const [outcomesResult, brainResult] = await Promise.all([
      loadJSON('data/outcomes.json', token, { manual: [] }),
      loadJSON('data/brain.json', token, {}),
    ]);

    const outcomes = outcomesResult.data;
    const outcomesSha = outcomesResult.sha;
    const brain = brainResult.data;
    const brainSha = brainResult.sha;

    outcomes.manual = outcomes.manual || [];
    outcomes.manual.push({ recommendationId, applied, result, recordedAt });
    if (outcomes.manual.length > 200) outcomes.manual = outcomes.manual.slice(-200);

    // Find and annotate matching decision log entry
    const decisionLog = brain.decisionLog || [];
    const idxNum = typeof recommendationId === 'number' ? recommendationId : parseInt(recommendationId, 10);

    let matchedEntry = null;
    if (!isNaN(idxNum) && idxNum >= 0 && idxNum < decisionLog.length) {
      matchedEntry = decisionLog[idxNum];
    } else {
      matchedEntry = decisionLog.find(entry => entry.id === recommendationId);
    }

    if (matchedEntry) {
      matchedEntry.outcome = { applied, result, recordedAt };
    }

    brain.decisionLog = decisionLog;
    brain.lastUpdated = new Date().toISOString();

    await Promise.all([
      ghPut('data/outcomes.json', JSON.stringify(outcomes, null, 2), outcomesSha, `Outcome: record result for recommendation ${recommendationId}`, token),
      ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainSha, `Outcome: annotate decision log entry ${recommendationId}`, token),
    ]);

    return jsonResponse({ saved: true });
  }

  // ── action: summary ───────────────────────────────────────────────────────────
  if (action === 'summary') {
    const outcomesResult = await loadJSON('data/outcomes.json', token, { manual: [] });
    const manual = outcomesResult.data.manual || [];

    const appliedEntries = manual.filter(e => e.applied === true);
    const ignoredEntries = manual.filter(e => e.applied === false);

    // Compute average metric improvement for applied entries that have before/after data
    const improvements = appliedEntries
      .filter(e => e.result && e.result.metricBefore != null && e.result.metricAfter != null)
      .map(e => e.result.metricAfter - e.result.metricBefore);

    const avgImprovement = improvements.length > 0
      ? improvements.reduce((sum, v) => sum + v, 0) / improvements.length
      : null;

    return jsonResponse({
      totalRecorded: manual.length,
      applied: appliedEntries.length,
      ignored: ignoredEntries.length,
      avgImprovement,
    });
  }

  return jsonResponse({ error: 'Unknown action. Use: record | summary' }, 400);
}
