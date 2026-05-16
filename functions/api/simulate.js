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

const ALL_SCENARIOS = [
  'price-increase-10pct',
  'price-decrease-5pct',
  'top-product-stockout',
  'competitor-undercut-20pct',
  'demand-surge-gpu',
];

const SCENARIO_DESCRIPTIONS = {
  'price-increase-10pct': 'What if we raise all product prices by 10%? Analyse the impact on revenue, customer behaviour, and competitive position.',
  'price-decrease-5pct': 'What if we drop all product prices by 5%? Analyse the impact on revenue, margins, customer acquisition, and competitive position.',
  'top-product-stockout': 'What if our best-selling product goes out of stock? Analyse the impact on revenue, customer satisfaction, and competitor advantage.',
  'competitor-undercut-20pct': 'What if a major competitor undercuts all our prices by 20%? Analyse the impact on market share, revenue, and required strategic response.',
  'demand-surge-gpu': 'What if GPU demand surges 3x due to a major AI market event (e.g. breakthrough model release)? Analyse the impact on stock, pricing power, revenue, and logistics.',
};

export async function onRequest(context) {
  if (context.request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  const token = context.env.GITHUB_PAT;
  const apiKey = context.env.ANTHROPIC_API_KEY;

  let body = {};
  try { body = await context.request.json(); } catch (_) {}
  const requestedScenarios = (body.scenarios && Array.isArray(body.scenarios) && body.scenarios.length > 0)
    ? body.scenarios.filter(s => ALL_SCENARIOS.includes(s))
    : ALL_SCENARIOS;

  const [productsRes, analyticsRes, competitorRes, brainRes] = await Promise.all([
    loadJSON('data/products.json', token, []),
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/competitor-prices.json', token, { products: [] }),
    loadJSON('data/brain.json', token, {}),
  ]);

  const products = productsRes.data || [];
  const analytics = analyticsRes.data || {};
  const competitor = competitorRes.data || {};
  const brain = brainRes.data || {};

  const sessions = (analytics.sessions || []).length;
  const hasCompetitorData = (competitor.products || []).length > 0;

  const contextStr = JSON.stringify({
    products: products.slice(0, 20),
    sessionCount: sessions,
    competitorPrices: (competitor.products || []).slice(0, 10),
    brainSummary: { skills: brain.skills, meta: brain.meta },
  }).slice(0, 8000);

  const baseConfidence = 0.5;
  const sessionBonus = Math.min(0.3, Math.floor(sessions / 10) * 0.1);
  const competitorBonus = hasCompetitorData ? 0.1 : 0;
  const confidence = Math.min(1, baseConfidence + sessionBonus + competitorBonus);

  const runScenario = async (scenarioName) => {
    const description = SCENARIO_DESCRIPTIONS[scenarioName] || scenarioName;
    const prompt = `Scenario: ${description}

Business context data: ${contextStr}

Return ONLY valid JSON with keys: scenario (string), revenueImpact (object with pct number and direction "up"|"down"|"neutral"), marginImpact (object with pct number and direction), customerImpact (string), competitivePosition (string), recommendations (array of strings), confidence (number 0-1), timeHorizon ("immediate"|"30d"|"90d")`;
    const raw = await callClaude(apiKey, 'You are a business scenario simulation engine for an AI hardware company. Simulate the business impact of the given scenario. Return ONLY valid JSON.', [{ role: 'user', content: prompt }], 2048);
    const result = parseJSON(raw);
    result.scenario = scenarioName;
    result.confidence = typeof result.confidence === 'number' ? (result.confidence + confidence) / 2 : confidence;
    return result;
  };

  const results = await Promise.all(requestedScenarios.map(s => runScenario(s).catch(e => ({ scenario: s, error: e.message }))));

  const timestamp = new Date().toISOString();
  const simulationsRes = await loadJSON('data/simulations.json', token, []);
  let simulations = simulationsRes.data || [];
  simulations.unshift({ timestamp, scenarios: results });
  if (simulations.length > 50) simulations = simulations.slice(0, 50);
  await ghPut('data/simulations.json', JSON.stringify(simulations, null, 2), simulationsRes.sha, 'chore: simulations ' + timestamp, token);

  return jsonResponse({ success: true, timestamp, scenarios: results });
}
