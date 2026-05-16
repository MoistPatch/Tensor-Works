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

  const [analyticsRes, brainRes, trendsRes] = await Promise.all([
    loadJSON('data/analytics.json', token, { sessions: [], pageViews: {}, productViews: {} }),
    loadJSON('data/brain.json', token, {}),
    loadJSON('data/trends.json', token, { daily: [], weekly: [] }),
  ]);

  const analytics = analyticsRes.data || {};
  const trends = trendsRes.data || { daily: [], weekly: [] };
  if (!trends.daily) trends.daily = [];
  if (!trends.weekly) trends.weekly = [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const cutoff24h = now.getTime() - 86400000;

  const sessions = analytics.sessions || [];
  const recentSessions = sessions.filter(s => new Date(s.timestamp || s.date || s).getTime() >= cutoff24h);
  const sessionCount = recentSessions.length;

  const productViewsMap = {};
  const pageViewsMap = {};

  const allEvents = analytics.events || analytics.pageViews || [];
  for (const ev of allEvents) {
    const ts = new Date(ev.timestamp || ev.date || ev).getTime();
    if (ts < cutoff24h) continue;
    if (ev.type === 'product_view' || ev.productHandle) {
      const handle = ev.productHandle || ev.handle;
      if (handle) productViewsMap[handle] = (productViewsMap[handle] || 0) + 1;
    }
    const page = ev.page || ev.path || ev.url;
    if (page) pageViewsMap[page] = (pageViewsMap[page] || 0) + 1;
  }

  let topProduct = null;
  let topCount = 0;
  for (const [handle, count] of Object.entries(productViewsMap)) {
    if (count > topCount) { topCount = count; topProduct = handle; }
  }

  const snapshot = { date: todayStr, sessions: sessionCount, productViews: productViewsMap, pageViews: pageViewsMap, topProduct };

  const existingIndex = trends.daily.findIndex(d => d.date === todayStr);
  if (existingIndex >= 0) trends.daily[existingIndex] = snapshot;
  else trends.daily.push(snapshot);

  trends.daily.sort((a, b) => a.date.localeCompare(b.date));
  if (trends.daily.length > 90) trends.daily = trends.daily.slice(-90);

  if (trends.daily.length > 0 && trends.daily.length % 7 === 0) {
    const last7 = trends.daily.slice(-7);
    const weeklyEntry = { date: last7[last7.length - 1].date, sessions: 0, productViews: {}, pageViews: {} };
    for (const day of last7) {
      weeklyEntry.sessions += day.sessions || 0;
      for (const [h, c] of Object.entries(day.productViews || {})) weeklyEntry.productViews[h] = (weeklyEntry.productViews[h] || 0) + c;
      for (const [p, c] of Object.entries(day.pageViews || {})) weeklyEntry.pageViews[p] = (weeklyEntry.pageViews[p] || 0) + c;
    }
    const existingWeekIndex = trends.weekly.findIndex(w => w.date === weeklyEntry.date);
    if (existingWeekIndex >= 0) trends.weekly[existingWeekIndex] = weeklyEntry;
    else trends.weekly.push(weeklyEntry);
    if (trends.weekly.length > 52) trends.weekly = trends.weekly.slice(-52);
  }

  let analysis = null;
  if (trends.daily.length >= 7) {
    const last30Daily = trends.daily.slice(-30);
    const last8Weekly = trends.weekly.slice(-8);
    const prompt = `Analyse this traffic and product view data for an AI hardware e-commerce store and return ONLY valid JSON with keys: trends (string summary), risingProducts (array of handles), fallingProducts (array of handles), seasonalPattern (string), confidenceScore (number 0-1), recommendations (array of strings).

Daily data (last 30 days): ${JSON.stringify(last30Daily)}
Weekly data (last 8 weeks): ${JSON.stringify(last8Weekly)}`;
    const raw = await callClaude(apiKey, 'You are a trend analyst for an AI hardware e-commerce store. Analyse traffic and product view data. Return ONLY valid JSON.', [{ role: 'user', content: prompt }]);
    analysis = parseJSON(raw);
  }

  trends.updatedAt = now.toISOString();
  await ghPut('data/trends.json', JSON.stringify(trends, null, 2), trendsRes.sha, 'chore: update trends ' + todayStr, token);

  return jsonResponse({ success: true, snapshot, ...(analysis ? { analysis } : {}) });
}
