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

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
      },
    });
  }

  const syncSecret = env.SYNC_SECRET;
  if (syncSecret) {
    const provided = request.headers.get('X-Sync-Secret');
    if (provided !== syncSecret) return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const { data } = await loadJSON('data/campaigns.json', token, { campaigns: [] });
    return jsonResponse(data);
  }

  if (request.method === 'POST') {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    try {
      const [
        { data: products },
        { data: analytics },
        { data: trends },
        { data: brain },
        { data: intelligenceReport },
        { data: existingCampaigns, sha: campaignsSha },
      ] = await Promise.all([
        loadJSON('data/products.json', token, []),
        loadJSON('data/analytics.json', token, {}),
        loadJSON('data/trends.json', token, {}),
        loadJSON('data/brain.json', token, {}),
        loadJSON('data/intelligence-report.json', token, {}),
        loadJSON('data/campaigns.json', token, { campaigns: [] }),
      ]);

      const productViews = analytics.productViews || {};
      const topViewedProducts = Object.entries(productViews)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([handle, views]) => {
          const product = (products || []).find(p => p.handle === handle);
          return { handle, views, title: product?.title, category: product?.category, price: product?.priceDisplay, inStock: product?.inStock };
        });

      const slowMoving = (products || [])
        .filter(p => p.inStock && (productViews[p.handle] || 0) < 5)
        .slice(0, 5)
        .map(p => ({ handle: p.handle, title: p.title, price: p.priceDisplay, views: productViews[p.handle] || 0 }));

      const competitorGaps = intelligenceReport?.priceRecommendations || [];

      const userPrompt = `Generate data-driven B2B marketing campaign strategies for Tensor Works.

TOP VIEWED PRODUCTS (last 30 days):
${JSON.stringify(topViewedProducts, null, 2)}

SLOW-MOVING INVENTORY (low views, in stock):
${JSON.stringify(slowMoving, null, 2)}

DETECTED TRENDS:
${JSON.stringify(trends, null, 2)}

COMPETITOR PRICING GAPS:
${JSON.stringify(competitorGaps.slice(0, 10), null, 2)}

BUSINESS INTELLIGENCE:
${JSON.stringify({ insights: intelligenceReport?.insights, alerts: intelligenceReport?.alerts }, null, 2)}

SEASONALITY & CONSTRAINTS FROM BRAIN:
${JSON.stringify({ seasonality: brain?.skills?.seasonality, constraints: brain?.constraints, patterns: brain?.skills?.products }, null, 2)}

Generate campaigns targeting enterprises, universities, and research institutions. Return JSON:
{
  "campaigns": [{
    "name": "string",
    "type": "email|featured-product|price-promotion|bundle|awareness",
    "targetAudience": "string",
    "headline": "string",
    "keyMessage": "string",
    "featuredProducts": ["handle"],
    "callToAction": "string",
    "urgencyTrigger": "string",
    "estimatedImpact": "string",
    "confidenceScore": 0.0,
    "suggestedTiming": "string",
    "reasoning": "string"
  }],
  "priorityOrder": ["campaign name"],
  "marketInsight": "string"
}`;

      const claudeResult = await callClaude(
        apiKey,
        'You are a B2B marketing strategist for Tensor Works, an Australian AI hardware reseller selling to enterprises, universities, and research institutions. Generate data-driven campaign strategies. Return JSON only.',
        userPrompt,
        3000
      );

      const newCampaigns = (claudeResult?.campaigns || []).map(c => ({
        id: 'campaign-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        ...c,
        status: 'generated',
        generatedAt: new Date().toISOString(),
      }));

      const existingList = existingCampaigns?.campaigns || [];
      const merged = [...existingList, ...newCampaigns].slice(-20);

      const updatedCampaignsData = {
        campaigns: merged,
        priorityOrder: claudeResult?.priorityOrder || [],
        marketInsight: claudeResult?.marketInsight || '',
        lastUpdated: new Date().toISOString(),
      };

      const freshCampaignsFile = await ghGet('data/campaigns.json', token).catch(() => null);
      const freshSha = freshCampaignsFile?.sha || campaignsSha;

      await ghPut('data/campaigns.json', JSON.stringify(updatedCampaignsData, null, 2), freshSha, 'Campaign strategist: generate ' + newCampaigns.length + ' campaigns', token);

      return jsonResponse({
        campaigns: newCampaigns,
        priorityOrder: claudeResult?.priorityOrder || [],
        marketInsight: claudeResult?.marketInsight || '',
        totalCampaigns: merged.length,
      });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
