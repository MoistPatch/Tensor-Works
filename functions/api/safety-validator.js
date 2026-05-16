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
async function callClaude(apiKey, system, messages, maxTokens = 2048) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: maxTokens, system, messages }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Anthropic API error');
  return (d.content || [])[0]?.text || '';
}
function parseJSON(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(clean);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const token = env.GITHUB_PAT;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const body = await request.json().catch(() => ({}));
  const { action, proposedChange, productHandle } = body;

  if (!action || !proposedChange) return jsonResponse({ error: 'action and proposedChange required' }, 400);

  const { data: brain, sha: brainSha } = await loadJSON('data/brain.json', token, null);
  if (!brain) return jsonResponse({ error: 'brain.json not found' }, 404);

  const constraints = brain.constraints || {};
  const minConfidence = constraints.minConfidenceToAutoApply ?? 0.75;
  const maxPriceChangePct = constraints.maxPriceChangePercent ?? 15;
  const requireHumanAboveAUD = constraints.requireHumanApprovalAbove?.priceChangeAUD ?? 5000;
  const frozenProducts = constraints.frozenProducts || [];
  const blacklistedActions = constraints.blacklistedActions || [];

  const failedChecks = [];
  let approved = true;
  let requiresHumanApproval = false;
  let deviationScore = 0;
  let claudeConcerns = [];

  const handle = proposedChange.handle || productHandle || null;

  if ((proposedChange.confidence ?? 0) < minConfidence) {
    failedChecks.push('confidenceScore');
    approved = false;
  }

  if (action === 'price-recommendation') {
    const newPrice = proposedChange.newPrice;
    const currentPrice = proposedChange.currentPrice;
    if (typeof newPrice === 'number' && typeof currentPrice === 'number' && currentPrice !== 0) {
      const pct = Math.abs((newPrice - currentPrice) / currentPrice * 100);
      if (pct > maxPriceChangePct) {
        failedChecks.push('priceChangePercent');
        approved = false;
      }
      const changeAUD = Math.abs(newPrice - currentPrice);
      if (changeAUD > requireHumanAboveAUD) {
        requiresHumanApproval = true;
      }
    }
  }

  if (handle && frozenProducts.includes(handle)) {
    failedChecks.push('frozenProducts');
    approved = false;
  }

  if (blacklistedActions.includes(action)) {
    failedChecks.push('blacklistedActions');
    approved = false;
  }

  try {
    const skillsSummary = JSON.stringify(brain.skills || {}).slice(0, 1500);
    const changeSummary = JSON.stringify(proposedChange).slice(0, 1000);
    const claudeText = await callClaude(
      apiKey,
      'You are a safety auditor for an AI-driven e-commerce pricing system for Tensor Works, an Australian B2B AI hardware and GPU retailer. Evaluate whether a proposed recommendation aligns with learned skills and historical patterns. Return only valid JSON.',
      [{ role: 'user', content: `Action: ${action}\nProposed change: ${changeSummary}\nLearned skills summary: ${skillsSummary}\n\nDoes this recommendation align with the learned skills and historical patterns? Is there any sign of deviation, oscillation, or drift? Return JSON: { "aligned": true/false, "deviationScore": 0.0, "concerns": [], "verdict": "approved|review|block" }` }],
      512,
    );
    const claudeResult = parseJSON(claudeText);
    deviationScore = typeof claudeResult.deviationScore === 'number' ? claudeResult.deviationScore : 0;
    claudeConcerns = Array.isArray(claudeResult.concerns) ? claudeResult.concerns : [];
    if (claudeResult.verdict === 'block') {
      failedChecks.push('claudeDeviationCheck');
      approved = false;
    } else if (claudeResult.verdict === 'review') {
      requiresHumanApproval = true;
    }
  } catch (e) {
    claudeConcerns = ['Claude deviation check failed: ' + e.message];
  }

  const validationResult = {
    approved,
    requiresHumanApproval,
    failedChecks,
    concerns: claudeConcerns,
    deviationScore,
    action,
    timestamp: new Date().toISOString(),
  };

  try {
    const history = brain.history || {};
    const decisions = history.decisions || [];
    decisions.push({
      type: 'safety-validation',
      action,
      approved,
      requiresHumanApproval,
      failedChecks,
      deviationScore,
      timestamp: validationResult.timestamp,
    });
    if (decisions.length > 100) decisions.splice(0, decisions.length - 100);
    brain.history = { ...history, decisions };
    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainSha, `Safety validation log: ${action}`, token);
  } catch (_) {}

  return jsonResponse(validationResult);
}
