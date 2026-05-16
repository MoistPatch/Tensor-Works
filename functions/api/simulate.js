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
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

function callClaude(apiKey, system, user, maxTokens = 2048) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  }).then(r => r.json()).then(d => {
    const text = (d.content || [])[0]?.text || '';
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(clean);
  });
}

const STANDARD_SCENARIOS = [
  {
    id: 'price_sensitivity',
    name: 'Price Sensitivity',
    question: 'If we reduce GPU Accelerator prices by 10%, what happens to revenue and margin based on current visitor analytics and competitor positioning?'
  },
  {
    id: 'bundle_impact',
    name: 'Bundle Impact',
    question: 'If we bundle the top 2 most-viewed products at 8% discount, what is the projected conversion lift?'
  },
  {
    id: 'competitor_response',
    name: 'Competitor Response',
    question: 'If a major competitor drops prices by 20%, what should our response strategy be?'
  },
  {
    id: 'demand_forecast',
    name: 'Demand Forecast',
    question: 'Based on current trend data, what will demand look like in the next 30 days for each product category?'
  },
  {
    id: 'stock_prioritisation',
    name: 'Stock Prioritisation',
    question: 'Given current analytics and competitor stock levels, which products should we prioritise for restocking?'
  }
];

function computeConfidence(trends, analytics, brain) {
  const dailyDays = (trends.daily || []).length;
  const sessions = (analytics.sessions || []).length;
  const runCount = brain.meta?.totalRunCount || 0;

  let score = 0;
  if (dailyDays >= 30) score += 0.35;
  else if (dailyDays >= 7) score += 0.2;
  else if (dailyDays >= 1) score += 0.1;

  if (sessions >= 500) score += 0.25;
  else if (sessions >= 100) score += 0.15;
  else if (sessions >= 10) score += 0.05;

  if (runCount >= 20) score += 0.25;
  else if (runCount >= 5) score += 0.15;
  else if (runCount >= 1) score += 0.05;

  const dqScore = brain.meta?.dataQualityScore || 0;
  score += dqScore * 0.15;

  return Math.min(1, Math.round(score * 100) / 100);
}

function buildContext(products, analytics, trends, brain, competitorPrices) {
  const productList = (Array.isArray(products) ? products : []).slice(0, 30);
  const recentDaily = (trends.daily || []).slice(-14);
  const recentWeekly = (trends.weekly || []).slice(-4);
  const recentSessions = (analytics.sessions || []).slice(-200);

  return {
    products: productList.map(p => ({ handle: p.handle, title: p.title, price: p.price, category: p.productType || p.category })),
    analytics: { recentSessions: recentSessions.length, recentDaily, recentWeekly },
    competitorPrices,
    brainMeta: brain.meta || {},
    brainPatterns: brain.patterns || {},
    brainSkills: brain.skills || {}
  };
}

async function runScenario(scenario, context, confidence, apiKey) {
  const result = await callClaude(
    apiKey,
    'You are a strategic business analyst for an Australian AI hardware reseller. You run what-if simulations using real business data. Return JSON only.',
    `Run this simulation scenario and return a JSON object with keys: scenario (string), prediction (string), confidence (number 0-1), keyAssumptions (array of strings), risks (array of strings), recommendation (string), timeframe (string).

Scenario: ${scenario.question}

Business context: ${JSON.stringify(context)}`,
    2048
  );

  return {
    id: scenario.id,
    name: scenario.name,
    scenario: result.scenario || scenario.question,
    prediction: result.prediction || '',
    confidence: result.confidence !== undefined ? result.confidence : confidence,
    dataConfidence: confidence,
    keyAssumptions: result.keyAssumptions || [],
    risks: result.risks || [],
    recommendation: result.recommendation || '',
    timeframe: result.timeframe || '',
    timestamp: new Date().toISOString()
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const token = env.GITHUB_TOKEN;
  const apiKey = env.ANTHROPIC_API_KEY;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  try {
    if (request.method === 'GET') {
      const { data: simulations } = await loadJSON('data/simulations.json', token, { simulations: [] });
      const last10 = (simulations.simulations || []).slice(-10);
      return jsonResponse({ simulations: last10, count: last10.length });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let body = {};
    try { body = await request.json(); } catch (_) { /* no body */ }

    const [
      { data: products },
      { data: analytics },
      { data: trends },
      { data: brain },
      { data: competitorPrices },
      { data: simulations, sha: simSha }
    ] = await Promise.all([
      loadJSON('data/products.json', token, []),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/trends.json', token, { daily: [], weekly: [], monthly: [], lastUpdated: null }),
      loadJSON('data/brain.json', token, { skills: {}, history: {}, patterns: {}, meta: { totalRunCount: 0, dataQualityScore: 0 } }),
      loadJSON('data/competitor-prices.json', token, {}),
      loadJSON('data/simulations.json', token, { simulations: [] })
    ]);

    const ctx = buildContext(products, analytics, trends, brain, competitorPrices);
    const confidence = computeConfidence(trends, analytics, brain);

    let scenariosToRun;
    if (body.scenario) {
      const matched = STANDARD_SCENARIOS.find(s => s.id === body.scenario || s.name === body.scenario);
      scenariosToRun = matched
        ? [matched]
        : [{ id: 'custom', name: 'Custom Scenario', question: body.scenario }];
    } else {
      scenariosToRun = STANDARD_SCENARIOS;
    }

    const results = await Promise.all(
      scenariosToRun.map(scenario => runScenario(scenario, ctx, confidence, apiKey).catch(err => ({
        id: scenario.id,
        name: scenario.name,
        scenario: scenario.question,
        prediction: 'Simulation failed: ' + err.message,
        confidence: 0,
        dataConfidence: confidence,
        keyAssumptions: [],
        risks: [],
        recommendation: '',
        timeframe: '',
        timestamp: new Date().toISOString()
      })))
    );

    if (!Array.isArray(simulations.simulations)) simulations.simulations = [];
    simulations.simulations.push(...results);
    simulations.simulations = simulations.simulations.slice(-50);

    await ghPut('data/simulations.json', JSON.stringify(simulations, null, 2), simSha, 'Update simulations', token);

    return jsonResponse({ simulations: results, count: results.length, dataConfidence: confidence });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
