/**
 * Experiment — simple A/B experiment runner.
 * GET: returns all experiments.
 * POST actions: create | assign | record-outcome | conclude
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

// Deterministic hash: sum of char codes mod 100
function hashVisitor(visitorId) {
  let sum = 0;
  for (let i = 0; i < visitorId.length; i++) sum += visitorId.charCodeAt(i);
  return sum % 100;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return all experiments ───────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/experiments.json', token, { experiments: [] });
    return jsonResponse(data);
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  const { data, sha } = await loadJSON('data/experiments.json', token, { experiments: [] });
  const experiments = data.experiments || [];

  // ── action: create ────────────────────────────────────────────────────────
  if (action === 'create') {
    const { name, productHandle, hypothesis, control, variant, trafficSplit = 0.5, durationDays = 14 } = body;
    if (!name || !productHandle || !control || !variant) {
      return jsonResponse({ error: 'name, productHandle, control, and variant are required' }, 400);
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const experiment = {
      id: Date.now(),
      name,
      productHandle,
      hypothesis: hypothesis || '',
      control,
      variant,
      trafficSplit,
      durationDays,
      status: 'active',
      createdAt: now.toISOString(),
      endsAt,
      assignments: { control: 0, variant: 0 },
      outcomes: { control: [], variant: [] },
    };

    experiments.push(experiment);
    if (experiments.length > 20) experiments.splice(0, experiments.length - 20);
    data.experiments = experiments;

    await ghPut('data/experiments.json', JSON.stringify(data, null, 2), sha, `Experiment: create "${name}"`, token);
    return jsonResponse({ created: true, id: experiment.id });
  }

  // ── action: assign ────────────────────────────────────────────────────────
  if (action === 'assign') {
    const { experimentId, visitorId } = body;
    if (!experimentId || !visitorId) return jsonResponse({ error: 'experimentId and visitorId are required' }, 400);

    const idx = experiments.findIndex(e => e.id === experimentId);
    if (idx === -1) return jsonResponse({ error: 'Experiment not found' }, 404);

    const exp = experiments[idx];

    // Return control if inactive or past end date
    if (exp.status !== 'active' || new Date() > new Date(exp.endsAt)) {
      return jsonResponse({ variant: 'control', reason: 'inactive', experimentId });
    }

    const bucket = hashVisitor(String(visitorId));
    const assigned = bucket < exp.trafficSplit * 100 ? 'variant' : 'control';

    exp.assignments[assigned] = (exp.assignments[assigned] || 0) + 1;
    data.experiments = experiments;

    await ghPut('data/experiments.json', JSON.stringify(data, null, 2), sha, `Experiment: assign visitor to ${assigned}`, token);
    return jsonResponse({ variant: assigned, experimentId });
  }

  // ── action: record-outcome ────────────────────────────────────────────────
  if (action === 'record-outcome') {
    const { experimentId, variant: variantName, value, type } = body;
    if (!experimentId || !variantName || value === undefined) {
      return jsonResponse({ error: 'experimentId, variant, and value are required' }, 400);
    }
    if (variantName !== 'control' && variantName !== 'variant') {
      return jsonResponse({ error: 'variant must be "control" or "variant"' }, 400);
    }

    const idx = experiments.findIndex(e => e.id === experimentId);
    if (idx === -1) return jsonResponse({ error: 'Experiment not found' }, 404);

    const exp = experiments[idx];
    exp.outcomes = exp.outcomes || { control: [], variant: [] };
    exp.outcomes[variantName] = exp.outcomes[variantName] || [];
    exp.outcomes[variantName].push({ value, type: type || 'purchase', recordedAt: new Date().toISOString() });

    data.experiments = experiments;
    await ghPut('data/experiments.json', JSON.stringify(data, null, 2), sha, `Experiment: record ${variantName} outcome`, token);
    return jsonResponse({ recorded: true });
  }

  // ── action: conclude ──────────────────────────────────────────────────────
  if (action === 'conclude') {
    const { experimentId } = body;
    if (!experimentId) return jsonResponse({ error: 'experimentId is required' }, 400);

    const idx = experiments.findIndex(e => e.id === experimentId);
    if (idx === -1) return jsonResponse({ error: 'Experiment not found' }, 404);

    const exp = experiments[idx];

    function computeStats(variantName) {
      const outcomes = (exp.outcomes && exp.outcomes[variantName]) || [];
      const assignments = (exp.assignments && exp.assignments[variantName]) || 0;
      const count = outcomes.length;
      const totalValue = outcomes.reduce((s, o) => s + (o.value || 0), 0);
      const avgValue = count > 0 ? totalValue / count : 0;
      const conversionRate = assignments > 0 ? count / assignments : 0;
      return { assignments, count, totalValue, avgValue, conversionRate };
    }

    const controlStats = computeStats('control');
    const variantStats = computeStats('variant');

    const winner = variantStats.conversionRate >= controlStats.conversionRate ? 'variant' : 'control';
    const baseRate = controlStats.conversionRate;
    const uplift = baseRate > 0
      ? ((variantStats.conversionRate - baseRate) / baseRate) * 100
      : 0;

    const results = {
      control: controlStats,
      variant: variantStats,
      winner,
      uplift: Math.round(uplift * 100) / 100,
    };

    exp.status = 'concluded';
    exp.results = results;
    exp.concludedAt = new Date().toISOString();

    data.experiments = experiments;
    await ghPut('data/experiments.json', JSON.stringify(data, null, 2), sha, `Experiment: conclude "${exp.name}"`, token);
    return jsonResponse({ concluded: true, results });
  }

  return jsonResponse({ error: 'Unknown action. Use: create | assign | record-outcome | conclude' }, 400);
}
