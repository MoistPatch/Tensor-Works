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

  const [
    { data: products },
    { data: analytics },
    { data: competitorPrices },
    { data: brain, sha: brainSha },
    { data: trends },
  ] = await Promise.all([
    loadJSON('data/products.json', token, []),
    loadJSON('data/analytics.json', token, {}),
    loadJSON('data/competitor-prices.json', token, { products: [] }),
    loadJSON('data/brain.json', token, {}),
    loadJSON('data/trends.json', token, { daily: [] }),
  ]);

  const { data: learningNotes } = await loadJSON('data/learning-notes.json', token, { notes: [] });

  let calculatedConfidence = 0.3;

  const sessions = analytics?.sessions ?? analytics?.totalSessions ?? 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentSessions = typeof sessions === 'number' ? sessions : 0;
  if (recentSessions >= 10) calculatedConfidence += 0.2;

  const competitorProducts = competitorPrices?.products || [];
  if (competitorProducts.length > 0) calculatedConfidence += 0.1;

  const dailyTrends = trends?.daily || [];
  if (dailyTrends.length >= 7) calculatedConfidence += 0.15;

  const dataQualityScore = brain?.meta?.dataQualityScore ?? 0;
  if (dataQualityScore >= 0.7) calculatedConfidence += 0.1;

  calculatedConfidence = Math.min(calculatedConfidence, 0.95);

  const systemPrompt = 'You are a pricing and merchandising AI for Tensor Works, an Australian B2B AI hardware and GPU retailer. Analyse the provided data and return structured JSON only.';

  const dataPayload = JSON.stringify({
    products: (products || []).slice(0, 50),
    analytics: analytics || {},
    competitorPrices: competitorPrices || {},
    brainConstraints: brain?.constraints || {},
    brainSkills: brain?.skills || {},
    trends: { daily: dailyTrends.slice(-30) },
    learningNotes: (learningNotes?.notes || []).slice(-20),
  }).slice(0, 12000);

  const userPrompt = `Analyse the following Tensor Works business data and return a JSON intelligence report.\n\nData:\n${dataPayload}\n\nReturn only this JSON structure:\n{\n  "priceRecommendations": [{"handle":"","currentPrice":0,"recommendedPrice":0,"changePercent":0,"rationale":"","confidence":0}],\n  "productRanking": [{"handle":"","currentRank":0,"recommendedRank":0,"rationale":""}],\n  "bundleSuggestions": [{"products":[],"bundleName":"","discount":0,"rationale":""}],\n  "marketInsights": "",\n  "confidenceScore": 0.0,\n  "dataQualityNote": ""\n}`;

  let claudeOutput;
  try {
    const raw = await callClaude(apiKey, systemPrompt, [{ role: 'user', content: userPrompt }], 4096);
    claudeOutput = parseJSON(raw);
  } catch (e) {
    return jsonResponse({ error: 'Claude analysis failed: ' + e.message }, 500);
  }

  const claudeConfidence = typeof claudeOutput.confidenceScore === 'number' ? claudeOutput.confidenceScore : calculatedConfidence;
  let overallConfidence = Math.min((claudeConfidence + calculatedConfidence) / 2, 0.95);

  const priceRecommendations = claudeOutput.priceRecommendations || [];
  const groundingPayload = JSON.stringify({ priceRecommendations, dataSnapshot: dataPayload.slice(0, 4000) }).slice(0, 8000);
  let groundingScore = 1.0;
  let ungroundedItems = [];
  try {
    const groundingRaw = await callClaude(
      apiKey,
      'You are a fact-checker for an AI pricing system. Verify that recommendations are grounded in the data provided. Return only valid JSON.',
      [{ role: 'user', content: `Verify that the price recommendations are grounded in the data provided. Flag any recommendations that are not supported.\n\nRecommendations and data:\n${groundingPayload}\n\nReturn JSON: { "verified": true/false, "groundingScore": 0.0, "ungroundedItems": [] }` }],
      512,
    );
    const groundingResult = parseJSON(groundingRaw);
    groundingScore = typeof groundingResult.groundingScore === 'number' ? groundingResult.groundingScore : 1.0;
    ungroundedItems = Array.isArray(groundingResult.ungroundedItems) ? groundingResult.ungroundedItems : [];
  } catch (_) {
    groundingScore = 0.8;
  }

  overallConfidence = Math.min(overallConfidence * groundingScore, 0.95);

  const runRecord = {
    timestamp: new Date().toISOString(),
    confidenceScore: overallConfidence,
    calculatedConfidence,
    groundingScore,
    priceRecommendationCount: priceRecommendations.length,
    productRankingCount: (claudeOutput.productRanking || []).length,
    bundleSuggestionCount: (claudeOutput.bundleSuggestions || []).length,
  };

  try {
    const history = brain?.history || {};
    const intelligenceRuns = history.intelligenceRuns || [];
    intelligenceRuns.push(runRecord);
    if (intelligenceRuns.length > 20) intelligenceRuns.splice(0, intelligenceRuns.length - 20);
    const updatedBrain = {
      ...brain,
      history: { ...history, intelligenceRuns },
      meta: {
        ...(brain?.meta || {}),
        lastOrchestrationAt: runRecord.timestamp,
      },
    };
    await ghPut('data/brain.json', JSON.stringify(updatedBrain, null, 2), brainSha, 'Intelligence run: ' + runRecord.timestamp, token);
  } catch (_) {}

  return jsonResponse({
    priceRecommendations,
    productRanking: claudeOutput.productRanking || [],
    bundleSuggestions: claudeOutput.bundleSuggestions || [],
    marketInsights: claudeOutput.marketInsights || '',
    confidenceScore: overallConfidence,
    dataQualityNote: claudeOutput.dataQualityNote || '',
    groundingScore,
    ungroundedItems,
    meta: runRecord,
  });
}
