/**
 * Monthly system update — 3-phase pipeline:
 * Phase 1: Claude synthesises all accumulated data into a master directive.
 * Phase 2: Second Claude validates directive against constraints and history.
 * Phase 3: Third Claude bug-checks and cleans the directive before implementing.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-SystemUpdate' },
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
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-SystemUpdate', 'Content-Type': 'application/json' },
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
async function callClaude(apiKey, system, messages, maxTokens = 3000) {
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

  // Load all data sources in parallel
  const [brainRes, analyticsRes, trendsRes, competitorRes, simulationsRes, campaignsRes, masterRes] = await Promise.all([
    loadJSON('data/brain.json', token, {}),
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/trends.json', token, { daily: [], weekly: [] }),
    loadJSON('data/competitor-prices.json', token, { products: [] }),
    loadJSON('data/simulations.json', token, { runs: [] }),
    loadJSON('data/campaigns.json', token, { campaigns: [] }),
    loadJSON('data/master-prompt.json', token, { version: 0, current: null, history: [] }),
  ]);

  const brain = brainRes.data || {};
  const context30d = {
    analytics: { recentSessions: ((analyticsRes.data?.sessions || []).slice(0, 50)) },
    trends: { daily: (trendsRes.data?.daily || []).slice(-30), weekly: (trendsRes.data?.weekly || []).slice(-8) },
    competitorPrices: (competitorRes.data?.products || []).slice(0, 20),
    recentSimulations: (simulationsRes.data?.runs || []).slice(0, 5),
    recentCampaigns: (campaignsRes.data?.campaigns || []).slice(0, 5),
    brainHistory: { intelligenceRuns: (brain.history?.intelligenceRuns || []).slice(0, 10), anomaliesDetected: (brain.history?.anomaliesDetected || []).slice(0, 10) },
    brainPatterns: brain.patterns || {},
    currentConstraints: brain.constraints || {},
    currentSkills: brain.skills || {},
  };
  const contextStr = JSON.stringify(context30d, null, 2).slice(0, 10000);

  // ── Phase 1: Synthesis ────────────────────────────────────────────────────
  const phase1System = `You are the master strategy synthesiser for Tensor Works, an Australian B2B AI hardware and GPU retailer. You have been given one month of accumulated data including analytics, trends, competitor intelligence, simulations, and campaign performance. Your job is to synthesise this into a master directive that will guide the system for the next month. Return ONLY valid JSON.`;
  const phase1User = `Analyse all the accumulated data and produce a comprehensive master directive for the next month.

ACCUMULATED DATA:
${contextStr}

Return ONLY this JSON structure:
{
  "pricingDirective": { "strategy": "string", "rules": ["rule1", "rule2"] },
  "productDirective": { "focusProducts": ["handle1"], "deprioritise": ["handle2"], "rankingGuidance": "string" },
  "salesDirective": { "primaryGoal": "string", "targetSegments": ["segment1"], "tactics": ["tactic1"] },
  "operationalRules": ["rule1", "rule2"],
  "learnedPatterns": { "key": "value" },
  "thingsToAvoid": ["thing1", "thing2"],
  "constraintRecommendations": { "maxPriceChangePercent": 15 },
  "strategicFocus": "string summary of strategic direction",
  "confidenceScore": 0.0,
  "dataQualityNote": "string"
}`;

  let phase1;
  try {
    const text = await callClaude(apiKey, phase1System, [{ role: 'user', content: phase1User }], 3000);
    phase1 = parseJSON(text);
  } catch (e) {
    return jsonResponse({ error: 'Phase 1 synthesis failed: ' + e.message, phase: 1 }, 500);
  }

  // ── Phase 2: Validation ───────────────────────────────────────────────────
  const phase2System = `You are a validation agent for an AI-driven e-commerce system. You review proposed strategic directives and check them against historical patterns, brain constraints, and past decisions for consistency and safety. Return ONLY valid JSON.`;
  const phase2User = `Validate this proposed master directive against the system's historical data and constraints.

PROPOSED DIRECTIVE:
${JSON.stringify(phase1, null, 2)}

BRAIN CONSTRAINTS:
${JSON.stringify(brain.constraints || {}, null, 2)}

DECISION LOG (last 10):
${JSON.stringify((brain.decisionLog || []).slice(0, 10), null, 2)}

Check for: contradictions with past decisions, constraint violations, unrealistic targets, signs of drift or oscillation, data quality issues.

Return:
{
  "approvedForImplementation": true,
  "validationScore": 0.0,
  "concerns": ["concern1"],
  "corrections": [{"field": "path.to.field", "issue": "what's wrong", "suggestion": "what to change"}],
  "summary": "one sentence validation verdict"
}`;

  let phase2;
  try {
    const text = await callClaude(apiKey, phase2System, [{ role: 'user', content: phase2User }], 2000);
    phase2 = parseJSON(text);
  } catch (e) {
    return jsonResponse({ error: 'Phase 2 validation failed: ' + e.message, phase: 2 }, 500);
  }

  if (!phase2.approvedForImplementation) {
    // Save as requires-review and return 202
    const master = masterRes.data || { version: 0, current: null, history: [] };
    const pendingEntry = { version: (master.version || 0) + 1, status: 'requires-review', directive: phase1, validation: phase2, createdAt: new Date().toISOString() };
    master.history = [pendingEntry, ...(master.history || [])].slice(0, 12);
    await ghPut('data/master-prompt.json', JSON.stringify(master, null, 2), masterRes.sha, 'System update: requires review', token);
    return jsonResponse({ status: 'requires-review', message: 'Directive blocked by validation phase', concerns: phase2.concerns, validationScore: phase2.validationScore }, 202);
  }

  // ── Phase 3: Bug check + clean ────────────────────────────────────────────
  const phase3System = `You are a bug-checking and cleaning agent. You receive a proposed master directive that has already passed validation. Your job is to apply corrections, ensure all values are correctly typed and in range, and produce the final cleaned directive. Return ONLY valid JSON.`;
  const phase3User = `Apply these corrections to the directive and produce the final clean version.

DIRECTIVE TO CLEAN:
${JSON.stringify(phase1, null, 2)}

CORRECTIONS FROM VALIDATION:
${JSON.stringify(phase2.corrections || [], null, 2)}

Rules:
- confidenceScore must be 0-1
- maxPriceChangePercent must be 5-25
- All arrays must remain arrays
- Remove any null values from arrays
- Ensure strategicFocus is a non-empty string

Return:
{
  "cleanedDirective": { ...the full corrected directive... },
  "implementationSafe": true,
  "changesMade": ["change1", "change2"]
}`;

  let phase3;
  try {
    const text = await callClaude(apiKey, phase3System, [{ role: 'user', content: phase3User }], 2000);
    phase3 = parseJSON(text);
  } catch (e) {
    return jsonResponse({ error: 'Phase 3 bug check failed: ' + e.message, phase: 3 }, 500);
  }

  if (!phase3.implementationSafe) {
    return jsonResponse({ error: 'Phase 3 deemed implementation unsafe', changesMade: phase3.changesMade }, 409);
  }

  const finalDirective = phase3.cleanedDirective || phase1;

  // ── Implement into brain ──────────────────────────────────────────────────
  const updatedBrain = { ...brain };
  updatedBrain.skills = { ...updatedBrain.skills, masterDirective: finalDirective };
  if (finalDirective.learnedPatterns) {
    updatedBrain.patterns = { ...(updatedBrain.patterns || {}), ...finalDirective.learnedPatterns };
  }
  if (finalDirective.constraintRecommendations) {
    const cr = finalDirective.constraintRecommendations;
    updatedBrain.constraints = { ...(updatedBrain.constraints || {}) };
    if (cr.maxPriceChangePercent) updatedBrain.constraints.maxPriceChangePercent = cr.maxPriceChangePercent;
    if (cr.minConfidenceToAutoApply) updatedBrain.constraints.minConfidenceToAutoApply = cr.minConfidenceToAutoApply;
  }
  if (finalDirective.thingsToAvoid) {
    updatedBrain.decisionLog = updatedBrain.decisionLog || [];
    updatedBrain.decisionLog.unshift({ type: 'system-update', action: 'thingsToAvoid', value: finalDirective.thingsToAvoid, timestamp: new Date().toISOString(), summary: 'Monthly system update: avoid list updated' });
    if (updatedBrain.decisionLog.length > 200) updatedBrain.decisionLog = updatedBrain.decisionLog.slice(0, 200);
  }
  updatedBrain.lastUpdated = new Date().toISOString();
  updatedBrain.meta = { ...(updatedBrain.meta || {}), totalRunCount: ((updatedBrain.meta || {}).totalRunCount || 0) + 1, lastSystemUpdateAt: new Date().toISOString() };

  await ghPut('data/brain.json', JSON.stringify(updatedBrain, null, 2), brainRes.sha, 'Monthly system update: brain implemented', token);

  // Save master-prompt.json
  const master = masterRes.data || { version: 0, current: null, history: [] };
  const newVersion = (master.version || 0) + 1;
  const entry = { version: newVersion, status: 'implemented', directive: finalDirective, validation: { validationScore: phase2.validationScore, concerns: phase2.concerns }, bugCheck: { changesMade: phase3.changesMade }, implementedAt: new Date().toISOString(), confidenceScore: finalDirective.confidenceScore };
  master.version = newVersion;
  master.current = entry;
  master.history = [entry, ...(master.history || [])].slice(0, 12);
  await ghPut('data/master-prompt.json', JSON.stringify(master, null, 2), masterRes.sha, 'System update: master prompt v' + newVersion, token);

  return jsonResponse({
    success: true,
    version: newVersion,
    confidenceScore: finalDirective.confidenceScore,
    validationScore: phase2.validationScore,
    changesMade: phase3.changesMade,
    strategicFocus: finalDirective.strategicFocus,
    implementedAt: new Date().toISOString(),
  });
}
