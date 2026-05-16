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

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildDailySnapshot(analytics, today) {
  const sessions = (analytics.sessions || []).filter(s => {
    const d = s.date || s.timestamp || s.createdAt || '';
    return d.startsWith(today);
  });

  const productViews = {};
  const pageViews = {};

  for (const session of sessions) {
    for (const event of (session.events || [])) {
      if (event.type === 'product_view' && event.handle) {
        productViews[event.handle] = (productViews[event.handle] || 0) + 1;
      }
      if (event.type === 'page_view' && event.path) {
        pageViews[event.path] = (pageViews[event.path] || 0) + 1;
      }
    }
    if (session.productHandle) {
      productViews[session.productHandle] = (productViews[session.productHandle] || 0) + 1;
    }
    if (session.page || session.path) {
      const p = session.page || session.path;
      pageViews[p] = (pageViews[p] || 0) + 1;
    }
  }

  let topProduct = null;
  let topCount = 0;
  for (const [handle, count] of Object.entries(productViews)) {
    if (count > topCount) { topCount = count; topProduct = handle; }
  }

  return { date: today, productViews, pageViews, topProduct, sessions: sessions.length };
}

function buildWeeklyRollup(dailyEntries) {
  if (dailyEntries.length === 0) return null;
  const weekStart = dailyEntries[0].date;
  const avgDailySessions = dailyEntries.reduce((s, d) => s + (d.sessions || 0), 0) / dailyEntries.length;

  const productTotals = {};
  for (const day of dailyEntries) {
    for (const [handle, count] of Object.entries(day.productViews || {})) {
      productTotals[handle] = (productTotals[handle] || 0) + count;
    }
  }
  const topProducts = Object.entries(productTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h]) => h);

  return { weekStart, avgDailySessions: Math.round(avgDailySessions * 10) / 10, topProducts, competitorPriceChanges: 0, anomalies: 0 };
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
      const { data: trends } = await loadJSON('data/trends.json', token, { daily: [], weekly: [], monthly: [], lastUpdated: null });
      return jsonResponse(trends);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const [
      { data: analytics },
      { data: competitorPrices },
      { data: trends, sha: trendsSha },
      { data: products }
    ] = await Promise.all([
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/competitor-prices.json', token, {}),
      loadJSON('data/trends.json', token, { daily: [], weekly: [], monthly: [], lastUpdated: null }),
      loadJSON('data/products.json', token, [])
    ]);

    const today = todayDateString();
    const snapshot = buildDailySnapshot(analytics, today);

    const existingIndex = trends.daily.findIndex(d => d.date === today);
    if (existingIndex >= 0) {
      trends.daily[existingIndex] = snapshot;
    } else {
      trends.daily.push(snapshot);
    }
    trends.daily = trends.daily.slice(-90);

    if (trends.daily.length > 0 && trends.daily.length % 7 === 0) {
      const last7 = trends.daily.slice(-7);
      const rollup = buildWeeklyRollup(last7);
      if (rollup) {
        trends.weekly.push(rollup);
        trends.weekly = trends.weekly.slice(-52);
      }
    }

    const last30Daily = trends.daily.slice(-30);
    const last8Weekly = trends.weekly.slice(-8);

    const claudeResult = await callClaude(
      apiKey,
      'You are a trend analyst for an Australian AI hardware reseller. Analyse time-series data and identify patterns. Return JSON only.',
      `Analyse this time-series data and return a JSON object with keys: trends (array of strings), risingProducts (array of handles), fallingProducts (array of handles), seasonalPattern (string), confidenceScore (number 0-1), recommendations (array of strings).

Last 30 daily entries: ${JSON.stringify(last30Daily)}

Last 8 weekly entries: ${JSON.stringify(last8Weekly)}

Competitor prices context: ${JSON.stringify(competitorPrices)}

Products catalogue: ${JSON.stringify((Array.isArray(products) ? products : []).slice(0, 20))}`,
      2048
    ).catch(() => ({
      trends: [],
      risingProducts: [],
      fallingProducts: [],
      seasonalPattern: 'insufficient data',
      confidenceScore: 0,
      recommendations: []
    }));

    trends.lastUpdated = new Date().toISOString();

    await ghPut('data/trends.json', JSON.stringify(trends, null, 2), trendsSha, 'Update trends analysis', token);

    return jsonResponse({
      trends: claudeResult.trends || [],
      risingProducts: claudeResult.risingProducts || [],
      fallingProducts: claudeResult.fallingProducts || [],
      seasonalPattern: claudeResult.seasonalPattern || '',
      confidenceScore: claudeResult.confidenceScore || 0,
      recommendations: claudeResult.recommendations || [],
      todaySnapshot: snapshot
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
