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
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g,''))), sha: f.sha }; }
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
  if (context.request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  const token = context.env.GITHUB_PAT;
  const apiKey = context.env.ANTHROPIC_API_KEY;

  const [analyticsRes, brainRes, trendsRes, competitorRes] = await Promise.all([
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/brain.json', token, { history: {}, decisionLog: [], skills: {}, meta: {} }),
    loadJSON('data/trends.json', token, { daily: [] }),
    loadJSON('data/competitor-prices.json', token, { products: [] }),
  ]);

  const analytics = analyticsRes.data || {};
  const brain = brainRes.data || {};
  if (!brain.history) brain.history = {};
  if (!brain.skills) brain.skills = {};
  if (!brain.meta) brain.meta = {};
  if (!brain.decisionLog) brain.decisionLog = [];

  const trends = trendsRes.data || { daily: [] };
  const competitor = competitorRes.data || {};

  const sessions = (analytics.sessions || []).length;
  const intelligenceRuns = (brain.history.intelligenceRuns || []).slice(-5);

  let dataQualityScore = 0;
  if (sessions >= 50) dataQualityScore += 0.25;
  if ((trends.daily || []).length >= 14) dataQualityScore += 0.2;
  if ((competitor.products || []).length > 0) dataQualityScore += 0.2;
  if ((brain.history.intelligenceRuns || []).length >= 3) dataQualityScore += 0.2;
  if ((brain.decisionLog || []).length >= 5) dataQualityScore += 0.15;

  const learningConfidence = dataQualityScore * 0.8 + ((brain.history.intelligenceRuns || []).length >= 5 ? 0.2 : 0);

  const prompt = `Identify stable patterns and learnings from these AI analysis runs and trends data. Return ONLY valid JSON with keys: learnedPatterns (object of key→string), pricingInsights (object), productInsights (object), thingsToAvoid (array of strings).

Intelligence runs (last 5): ${JSON.stringify(intelligenceRuns)}
Trends analysis: ${JSON.stringify({ daily: (trends.daily || []).slice(-14), weekly: (trends.weekly || []).slice(-4) })}`;

  const raw = await callClaude(apiKey, 'You are a learning extraction system. Identify stable patterns and learnings from these AI analysis runs. Return ONLY valid JSON.', [{ role: 'user', content: prompt }]);
  const learnings = parseJSON(raw);

  brain.skills = Object.assign({}, brain.skills, learnings.learnedPatterns || {});
  if (learnings.pricingInsights) brain.skills.pricingInsights = Object.assign({}, brain.skills.pricingInsights || {}, learnings.pricingInsights);
  if (learnings.productInsights) brain.skills.productInsights = Object.assign({}, brain.skills.productInsights || {}, learnings.productInsights);
  if (Array.isArray(learnings.thingsToAvoid)) {
    const existing = brain.skills.thingsToAvoid || [];
    brain.skills.thingsToAvoid = [...new Set([...existing, ...learnings.thingsToAvoid])];
  }

  const hist = brain.history;
  if (hist.priceChanges) hist.priceChanges = hist.priceChanges.slice(-50);
  if (hist.rankingChanges) hist.rankingChanges = hist.rankingChanges.slice(-50);
  if (hist.bundleChanges) hist.bundleChanges = hist.bundleChanges.slice(-50);
  if (hist.campaignOutcomes) hist.campaignOutcomes = hist.campaignOutcomes.slice(-50);
  if (hist.intelligenceRuns) hist.intelligenceRuns = hist.intelligenceRuns.slice(-20);
  if (hist.anomaliesDetected) hist.anomaliesDetected = hist.anomaliesDetected.slice(-100);

  brain.meta.dataQualityScore = dataQualityScore;
  brain.meta.learningConfidence = learningConfidence;
  brain.meta.lastMemoryManagerAt = new Date().toISOString();

  await ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainRes.sha, 'chore: memory-manager update ' + brain.meta.lastMemoryManagerAt, token);

  const patternsLearned = Object.keys(learnings.learnedPatterns || {}).length;
  return jsonResponse({ success: true, dataQualityScore, learningConfidence, patternsLearned });
}
