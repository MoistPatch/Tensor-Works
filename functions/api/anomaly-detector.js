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

function computeCurrentDayMetrics(analytics, today) {
  const sessions = (analytics.sessions || []).filter(s => {
    const d = s.date || s.timestamp || s.createdAt || '';
    return d.startsWith(today);
  });

  const productViews = {};
  for (const session of sessions) {
    for (const event of (session.events || [])) {
      if (event.type === 'product_view' && event.handle) {
        productViews[event.handle] = (productViews[event.handle] || 0) + 1;
      }
    }
    if (session.productHandle) {
      productViews[session.productHandle] = (productViews[session.productHandle] || 0) + 1;
    }
  }

  let topProduct = null;
  let topCount = 0;
  for (const [handle, count] of Object.entries(productViews)) {
    if (count > topCount) { topCount = count; topProduct = handle; }
  }

  return { sessions: sessions.length, productViews, topProduct };
}

function compute30DayBaselines(trends) {
  const last30 = (trends.daily || []).slice(-30);
  if (last30.length === 0) return { avgSessions: 0, avgProductViews: {} };

  const avgSessions = last30.reduce((s, d) => s + (d.sessions || 0), 0) / last30.length;

  const productTotals = {};
  const productDays = {};
  for (const day of last30) {
    for (const [handle, count] of Object.entries(day.productViews || {})) {
      productTotals[handle] = (productTotals[handle] || 0) + count;
      productDays[handle] = (productDays[handle] || 0) + 1;
    }
  }

  const avgProductViews = {};
  for (const handle of Object.keys(productTotals)) {
    avgProductViews[handle] = productTotals[handle] / last30.length;
  }

  return { avgSessions, avgProductViews, days: last30.length };
}

function getLastWeekTopProducts(trends) {
  const weekly = trends.weekly || [];
  if (weekly.length === 0) return [];
  const lastWeek = weekly[weekly.length - 1];
  return (lastWeek.topProducts || []).slice(0, 3);
}

function detectCompetitorPriceDrops(competitorPrices) {
  const anomalies = [];
  const competitors = competitorPrices.competitors || competitorPrices;
  if (!competitors || typeof competitors !== 'object') return anomalies;

  for (const [competitorName, data] of Object.entries(competitors)) {
    const products = Array.isArray(data) ? data : (data.products || []);
    for (const product of products) {
      const current = product.currentPrice || product.price;
      const previous = product.previousPrice || product.lastPrice;
      if (current && previous && previous > 0) {
        const dropPct = ((previous - current) / previous) * 100;
        if (dropPct > 15) {
          anomalies.push({
            type: 'competitor_price_drop',
            description: `Competitor price drop: ${competitorName} dropped ${product.handle || product.name || 'product'} by ${Math.round(dropPct)}%`,
            competitor: competitorName,
            product: product.handle || product.name,
            dropPercent: Math.round(dropPct)
          });
        }
      }
    }
  }
  return anomalies;
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
      const { data: brain } = await loadJSON('data/brain.json', token, { history: { anomaliesDetected: [] } });
      const last20 = (brain.history?.anomaliesDetected || []).slice(-20);
      return jsonResponse({ anomalies: last20, count: last20.length });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const [
      { data: trends },
      { data: competitorPrices },
      { data: analytics },
      { data: brain, sha: brainSha }
    ] = await Promise.all([
      loadJSON('data/trends.json', token, { daily: [], weekly: [], monthly: [], lastUpdated: null }),
      loadJSON('data/competitor-prices.json', token, {}),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/brain.json', token, {
        skills: { pricing: {}, products: { topPerformers: [], slowMovers: [] }, competitors: {}, campaigns: {} },
        history: { priceChanges: [], intelligenceRuns: [], anomaliesDetected: [] },
        patterns: { weeklyTrafficShape: {}, productViewCorrelations: {}, priceElasticityByCategory: {}, competitorResponseLag: {} },
        meta: { totalRunCount: 0, dataQualityScore: 0, learningConfidence: 0, notes: [] }
      })
    ]);

    const today = todayDateString();
    const current = computeCurrentDayMetrics(analytics, today);
    const baseline = compute30DayBaselines(trends);
    const lastWeekTop3 = getLastWeekTopProducts(trends);

    const rawAnomalies = [];

    if (baseline.avgSessions > 0) {
      const ratio = current.sessions / baseline.avgSessions;
      if (ratio < 0.3) {
        rawAnomalies.push({ type: 'low_traffic', description: 'Low traffic anomaly', sessions: current.sessions, baseline: baseline.avgSessions, ratio });
      } else if (ratio > 3.0) {
        rawAnomalies.push({ type: 'traffic_spike', description: 'Traffic spike', sessions: current.sessions, baseline: baseline.avgSessions, ratio });
      }
    }

    const competitorDropAnomalies = detectCompetitorPriceDrops(competitorPrices);
    rawAnomalies.push(...competitorDropAnomalies);

    for (const handle of lastWeekTop3) {
      const todayViews = current.productViews[handle] || 0;
      if (todayViews === 0) {
        rawAnomalies.push({ type: 'engagement_drop', description: `Engagement drop: ${handle}`, product: handle });
      }
    }

    for (const [handle, todayCount] of Object.entries(current.productViews)) {
      const avgViews = baseline.avgProductViews[handle] || 0;
      if (avgViews > 0 && todayCount > avgViews * 3) {
        rawAnomalies.push({ type: 'demand_spike', description: `Demand spike: ${handle}`, product: handle, todayViews: todayCount, avgViews });
      }
    }

    const detectedAt = new Date().toISOString();
    const enrichedAnomalies = await Promise.all(
      rawAnomalies.map(async (anomaly) => {
        try {
          const assessment = await callClaude(
            apiKey,
            'You are a business analyst. Rate anomaly severity (low/medium/high) and suggest immediate actions. Return JSON only.',
            `Assess this anomaly and return JSON with keys: severity (low/medium/high), suggestedAction (string), urgency (string).

Anomaly: ${JSON.stringify(anomaly)}`,
            512
          );
          return { ...anomaly, severity: assessment.severity || 'medium', suggestedAction: assessment.suggestedAction || '', urgency: assessment.urgency || 'normal', detectedAt };
        } catch (_) {
          return { ...anomaly, severity: 'medium', suggestedAction: 'Review manually', urgency: 'normal', detectedAt };
        }
      })
    );

    if (!brain.history) brain.history = {};
    if (!Array.isArray(brain.history.anomaliesDetected)) brain.history.anomaliesDetected = [];

    brain.history.anomaliesDetected.push(...enrichedAnomalies);
    brain.history.anomaliesDetected = brain.history.anomaliesDetected.slice(-100);

    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainSha, 'Update anomaly detections', token);

    return jsonResponse({ anomalies: enrichedAnomalies, count: enrichedAnomalies.length });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
