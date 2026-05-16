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

function buildCorrelationMatrix(analytics, products) {
  const sessions = analytics.sessions || [];
  const productHandles = new Set(products.map(p => p.handle));
  const pairCounts = {};

  for (const session of sessions) {
    const viewed = (session.viewedProducts || []).filter(h => productHandles.has(h));
    if (viewed.length < 2) continue;
    for (let i = 0; i < viewed.length; i++) {
      for (let j = i + 1; j < viewed.length; j++) {
        const key = [viewed[i], viewed[j]].sort().join('|||');
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  }

  return pairCounts;
}

function getTopPairs(pairCounts, n = 5) {
  return Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => {
      const [a, b] = key.split('|||');
      return { handles: [a, b], count };
    });
}

function productKey(handles) {
  return [...handles].sort().join('|||');
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
    const { data, sha } = await loadJSON('data/bundles.json', token, []);
    return jsonResponse({ bundles: data, sha });
  }

  if (request.method === 'POST') {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    try {
      const [
        { data: products },
        { data: analytics },
        { data: brain },
        { data: existingBundles, sha: bundlesSha },
        { data: intelligenceReport },
      ] = await Promise.all([
        loadJSON('data/products.json', token, []),
        loadJSON('data/analytics.json', token, {}),
        loadJSON('data/brain.json', token, {}),
        loadJSON('data/bundles.json', token, []),
        loadJSON('data/intelligence-report.json', token, {}),
      ]);

      const pairCounts = buildCorrelationMatrix(analytics, products);
      const topPairs = getTopPairs(pairCounts, 5);

      const minMarginAUD = brain?.constraints?.minMarginAUD || 50;

      const productMap = Object.fromEntries(products.map(p => [p.handle, p]));

      const pairDetails = topPairs.map(pair => {
        const [hA, hB] = pair.handles;
        const pA = productMap[hA];
        const pB = productMap[hB];
        if (!pA || !pB) return null;

        const priceA = parseFloat(pA.priceDisplay) || 0;
        const priceB = parseFloat(pB.priceDisplay) || 0;
        const costA = parseFloat(pA.costExGst) || 0;
        const costB = parseFloat(pB.costExGst) || 0;
        const marginA = priceA - costA;
        const marginB = priceB - costB;
        const combinedMargin = marginA + marginB;
        const combinedPrice = priceA + priceB;

        const marginHeadroom = combinedMargin - minMarginAUD;
        const maxDiscountPct = combinedPrice > 0 ? (marginHeadroom / combinedPrice) * 100 : 0;
        const suggestedDiscount = Math.min(12, Math.max(5, Math.floor(maxDiscountPct * 0.6)));

        const priceCompatibility = Math.abs(priceA - priceB) / Math.max(priceA, priceB, 1);
        const priceCompatScore = Math.max(0, 1 - priceCompatibility);
        const sameCategory = pA.category === pB.category ? 0.2 : 0.1;
        const frequencyScore = Math.min(0.4, pair.count / 20);
        const confidenceScore = Math.min(1, 0.3 + frequencyScore + priceCompatScore * 0.3 + sameCategory);

        return {
          handles: [hA, hB],
          count: pair.count,
          combinedMargin,
          combinedPrice,
          suggestedDiscount,
          confidenceScore: Math.round(confidenceScore * 100) / 100,
          products: [pA, pB].map(p => ({ handle: p.handle, title: p.title, category: p.category, price: p.priceDisplay })),
        };
      }).filter(Boolean);

      const claudeResult = await callClaude(
        apiKey,
        'You are a bundle strategy specialist for an Australian AI hardware reseller. Suggest optimal product bundles based on viewing patterns and margins. Return JSON only.',
        `Co-viewing correlation data (top pairs):
${JSON.stringify(pairDetails, null, 2)}

Product skills context:
${JSON.stringify(brain?.skills?.products || {}, null, 2)}

Intelligence report context:
${JSON.stringify({ trends: intelligenceReport?.trends, insights: intelligenceReport?.insights }, null, 2)}

Based on this data, suggest optimal bundles. Return JSON:
{"bundles": [{"name": "string", "description": "string", "products": ["handle1", "handle2"], "discountPct": 10, "rationale": "string", "estimatedConversionLift": "string", "confidenceScore": 0.8, "targetCustomerType": "string"}]}`,
        2048
      );

      const suggestedBundles = claudeResult?.bundles || [];

      const approvedBundles = suggestedBundles.filter(b => {
        if (!b.products || b.products.length < 2) return false;
        if ((b.discountPct || 0) >= 15) return false;

        const bundleProducts = b.products.map(h => productMap[h]).filter(Boolean);
        const combinedMargin = bundleProducts.reduce((sum, p) => {
          const price = parseFloat(p.priceDisplay) || 0;
          const cost = parseFloat(p.costExGst) || 0;
          return sum + (price - cost);
        }, 0);

        const combinedPrice = bundleProducts.reduce((sum, p) => sum + (parseFloat(p.priceDisplay) || 0), 0);
        const discountAmount = combinedPrice * ((b.discountPct || 0) / 100);
        return combinedMargin - discountAmount >= minMarginAUD;
      });

      const existingKeys = new Set((existingBundles || []).map(b => productKey(b.products || [])));
      const newBundles = [];

      for (const bundle of approvedBundles) {
        const key = productKey(bundle.products);
        if (!existingKeys.has(key)) {
          newBundles.push({
            id: 'bundle-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            ...bundle,
            generatedAt: new Date().toISOString(),
            status: 'active',
          });
          existingKeys.add(key);
        }
      }

      const mergedBundles = [...(existingBundles || []), ...newBundles];

      const freshBundlesFile = await ghGet('data/bundles.json', token).catch(() => null);
      const freshSha = freshBundlesFile?.sha || bundlesSha;

      await ghPut('data/bundles.json', JSON.stringify(mergedBundles, null, 2), freshSha, 'Bundle optimizer: add ' + newBundles.length + ' new bundles', token);

      const avgConfidence = approvedBundles.length > 0
        ? approvedBundles.reduce((s, b) => s + (b.confidenceScore || 0), 0) / approvedBundles.length
        : 0;

      return jsonResponse({
        bundles: mergedBundles,
        newBundles: newBundles.length,
        confidence: Math.round(avgConfidence * 100) / 100,
      });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
