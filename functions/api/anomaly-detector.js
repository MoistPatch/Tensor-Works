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

  const [analyticsRes, brainRes, competitorRes, trendsRes] = await Promise.all([
    loadJSON('data/analytics.json', token, { sessions: [], events: [] }),
    loadJSON('data/brain.json', token, { history: { anomaliesDetected: [] }, decisionLog: [] }),
    loadJSON('data/competitor-prices.json', token, { products: [], crawledAt: null, previousCrawledAt: null }),
    loadJSON('data/trends.json', token, { daily: [] }),
  ]);

  const analytics = analyticsRes.data || {};
  const brain = brainRes.data || {};
  if (!brain.history) brain.history = {};
  if (!brain.history.anomaliesDetected) brain.history.anomaliesDetected = [];

  const competitor = competitorRes.data || {};
  const trends = trendsRes.data || { daily: [] };

  const now = new Date();
  const cutoff24h = now.getTime() - 86400000;
  const cutoff30d = now.getTime() - 30 * 86400000;

  const sessions = analytics.sessions || [];
  const todaySessions = sessions.filter(s => new Date(s.timestamp || s.date || s).getTime() >= cutoff24h).length;
  const last30Sessions = sessions.filter(s => new Date(s.timestamp || s.date || s).getTime() >= cutoff30d).length;
  const daily30avg = last30Sessions / 30;

  const events = analytics.events || [];
  const productViewsToday = {};
  const productViews30d = {};
  for (const ev of events) {
    const ts = new Date(ev.timestamp || ev.date || ev).getTime();
    const handle = ev.productHandle || ev.handle;
    if (!handle) continue;
    if (ts >= cutoff30d) productViews30d[handle] = (productViews30d[handle] || 0) + 1;
    if (ts >= cutoff24h) productViewsToday[handle] = (productViewsToday[handle] || 0) + 1;
  }

  const anomalies = [];

  if (daily30avg > 0 && todaySessions < daily30avg * 0.3) {
    anomalies.push({ type: 'low-traffic', severity: 'high', metric: todaySessions, baseline: daily30avg, detail: `Today sessions (${todaySessions}) below 30% of 30d avg (${daily30avg.toFixed(1)})` });
  }

  if (daily30avg > 0 && todaySessions > daily30avg * 3) {
    anomalies.push({ type: 'traffic-spike', severity: 'medium', metric: todaySessions, baseline: daily30avg, detail: `Today sessions (${todaySessions}) above 300% of 30d avg (${daily30avg.toFixed(1)})` });
  }

  const competitorProducts = competitor.products || [];
  for (const product of competitorProducts) {
    const currentPrice = product.price || product.currentPrice;
    const previousPrice = product.previousPrice;
    if (currentPrice && previousPrice && previousPrice > 0) {
      const drop = (previousPrice - currentPrice) / previousPrice;
      if (drop > 0.15) {
        anomalies.push({ type: 'competitor-price-drop', severity: 'critical', metric: drop, handle: product.handle || product.title, detail: `Competitor price dropped ${(drop * 100).toFixed(1)}% for ${product.handle || product.title}` });
      }
    }
  }

  const top3Handles = Object.entries(productViews30d)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => h);
  const top3ZeroToday = top3Handles.length > 0 && top3Handles.every(h => !productViewsToday[h]);
  if (top3ZeroToday) {
    anomalies.push({ type: 'engagement-drop', severity: 'high', metric: 0, handles: top3Handles, detail: `Top 3 products by 30d views have zero views in last 24h` });
  }

  const daily30dAvgByProduct = {};
  for (const [h, count] of Object.entries(productViews30d)) daily30dAvgByProduct[h] = count / 30;
  for (const [handle, todayCount] of Object.entries(productViewsToday)) {
    const avg = daily30dAvgByProduct[handle] || 0;
    if (avg > 0 && todayCount > avg * 3) {
      anomalies.push({ type: 'demand-spike', severity: 'medium', metric: todayCount, baseline: avg, handle, detail: `${handle} views (${todayCount}) exceed 3x 30d daily avg (${avg.toFixed(1)})` });
    }
  }

  let enrichedAnomalies = anomalies;
  if (anomalies.length > 0) {
    const prompt = `These anomalies were detected for an AI hardware e-commerce store. For each anomaly add businessImpact, suggestedAction, and urgency fields. Return ONLY valid JSON array.

Anomalies: ${JSON.stringify(anomalies)}`;
    const raw = await callClaude(apiKey, 'You are an anomaly analyst. Rate severity, explain business impact, and suggest immediate actions. Return ONLY valid JSON.', [{ role: 'user', content: prompt }]);
    try { enrichedAnomalies = parseJSON(raw); } catch (_) { enrichedAnomalies = anomalies; }
  }

  const detectedAt = now.toISOString();
  const record = { detectedAt, anomalies: enrichedAnomalies };
  brain.history.anomaliesDetected.push(record);
  if (brain.history.anomaliesDetected.length > 100) brain.history.anomaliesDetected = brain.history.anomaliesDetected.slice(-100);

  await ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainRes.sha, 'chore: anomaly detection ' + detectedAt, token);

  const criticalCount = enrichedAnomalies.filter(a => a.severity === 'critical').length;
  return jsonResponse({ anomaliesDetected: enrichedAnomalies, count: enrichedAnomalies.length, criticalCount });
}
