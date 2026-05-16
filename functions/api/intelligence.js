const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-opus-4-7';

async function ghGet(path, token) {
  const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TensorWorks-Admin',
    },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}

async function ghPut(path, content, sha, message, token) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded };
  if (sha) body.sha = sha;
  const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TensorWorks-Admin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || 'GitHub PUT failed: ' + r.status);
  }
  return r.json();
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function parseJsonSafe(text) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
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
    if (provided !== syncSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    try {
      const file = await ghGet('data/intelligence-report.json', token);
      const report = JSON.parse(atob(file.content.replace(/\n/g, '')));
      return jsonResponse({ report, sha: file.sha });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    try {
      const [productsFile, pricesFile, analyticsFile, rulesFile, bundlesFile, reportFile, brainFile, trendsFile] = await Promise.all([
        ghGet('data/products.json', token),
        ghGet('data/competitor-prices.json', token),
        ghGet('data/analytics.json', token),
        ghGet('data/pricing-rules.json', token),
        ghGet('data/bundles.json', token),
        ghGet('data/intelligence-report.json', token),
        ghGet('data/brain.json', token).catch(() => null),
        ghGet('data/trends.json', token).catch(() => null),
      ]);

      const products = JSON.parse(atob(productsFile.content.replace(/\n/g, '')));
      const competitorPrices = JSON.parse(atob(pricesFile.content.replace(/\n/g, '')));
      const analytics = JSON.parse(atob(analyticsFile.content.replace(/\n/g, '')));
      const pricingRules = JSON.parse(atob(rulesFile.content.replace(/\n/g, '')));
      const brain = brainFile ? JSON.parse(atob(brainFile.content.replace(/\n/g, ''))) : {};
      const trends = trendsFile ? JSON.parse(atob(trendsFile.content.replace(/\n/g, ''))) : {};

      const intelligenceRuns = brain?.history?.intelligenceRuns || [];
      const previousRunCount = intelligenceRuns.length;
      const trendsEntries = Array.isArray(trends?.daily) ? trends.daily.length : (typeof trends === 'object' ? Object.keys(trends).length : 0);

      const productViews = analytics.productViews || {};
      const topProducts = Object.entries(productViews)
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 20)
        .map(function(e) { return { handle: e[0], views: e[1] }; });

      const sessions = analytics.sessions || [];
      const date30 = new Date();
      date30.setDate(date30.getDate() - 30);
      const date30str = date30.toISOString().slice(0, 10);
      const recentSessions = sessions.filter(function(s) { return s.date >= date30str; });

      // B. Brain cross-reference: build enriched system prompt
      const brainContext = brain && Object.keys(brain).length > 0
        ? `\nYou have access to accumulated business intelligence from ${previousRunCount} previous runs. Learned patterns: ${JSON.stringify(brain?.skills || {})}. Known constraints: ${JSON.stringify(brain?.constraints || {})}. Ensure recommendations are consistent with learned patterns and do not violate constraints.`
        : '';

      const systemPrompt = 'You are an AI business intelligence analyst for Tensor Works, an Australian AI hardware reseller. Analyze the provided data and return strategic recommendations as JSON.' + brainContext;

      const userPrompt = `Analyze this business data for Tensor Works and provide strategic intelligence.

PRODUCT CATALOGUE (${products.length} products):
${JSON.stringify(products.map(function(p) { return { handle: p.handle, title: p.title, category: p.category, priceDisplay: p.priceDisplay, costExGst: p.costExGst, inStock: p.inStock, tags: p.tags }; }), null, 2)}

PRICING RULES:
${JSON.stringify(pricingRules, null, 2)}

COMPETITOR PRICE DATA:
${JSON.stringify(competitorPrices, null, 2)}

ANALYTICS (last 30 days, ${recentSessions.length} sessions):
Top products by views: ${JSON.stringify(topProducts, null, 2)}
Total sessions: ${sessions.length}

Return ONLY valid JSON in this exact structure:
{
  "priceRecommendations": [{"handle": "...", "currentPrice": "...", "recommendedPrice": "...", "reasoning": "..."}],
  "productRanking": ["handle1", "handle2"],
  "bundles": [{"name": "...", "description": "...", "products": ["handle1", "handle2"], "discountPct": 10, "reasoning": "..."}],
  "trends": ["trend description 1"],
  "insights": ["insight 1"],
  "alerts": ["alert 1"]
}`;

      const r = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error?.message || 'Anthropic API failed: ' + r.status);
      }

      const aiData = await r.json();
      const responseText = aiData.content[0].text;
      const parsed = parseJsonSafe(responseText);

      if (!parsed) {
        throw new Error('Failed to parse AI response as JSON');
      }

      // A. Confidence scoring for each price recommendation
      const priceRecommendations = (parsed.priceRecommendations || []).map(function(rec) {
        let score = 0.3;
        // +0.2 if competitor price data exists for this product
        const hasCompetitorData = Object.values(competitorPrices).some(function(siteData) {
          return Array.isArray(siteData) && siteData.some(function(m) { return m.matchedHandle === rec.handle; });
        });
        if (hasCompetitorData) score += 0.2;
        // +0.2 if analytics shows views > 0
        if ((productViews[rec.handle] || 0) > 0) score += 0.2;
        // +0.15 if brain has > 5 previous intelligence runs
        if (previousRunCount > 5) score += 0.15;
        // +0.15 if trends.json has > 14 daily entries
        if (trendsEntries > 14) score += 0.15;
        return Object.assign({}, rec, { confidenceScore: Math.min(1, Math.round(score * 100) / 100) });
      });

      const report = {
        generatedAt: new Date().toISOString(),
        priceRecommendations,
        productRanking: parsed.productRanking || [],
        bundles: parsed.bundles || [],
        trends: parsed.trends || [],
        insights: parsed.insights || [],
        alerts: parsed.alerts || [],
      };

      const newBundles = (parsed.bundles || []).map(function(b) {
        return {
          id: 'bundle-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          name: b.name,
          description: b.description,
          products: b.products || [],
          discountPct: b.discountPct || 0,
          generatedAt: new Date().toISOString(),
        };
      });

      const freshReportFile = await ghGet('data/intelligence-report.json', token);
      const freshBundlesFile = await ghGet('data/bundles.json', token);

      await Promise.all([
        ghPut('data/intelligence-report.json', JSON.stringify(report, null, 2), freshReportFile.sha, 'Intelligence report: ' + new Date().toISOString().slice(0, 10), token),
        ghPut('data/bundles.json', JSON.stringify(newBundles, null, 2), freshBundlesFile.sha, 'Update bundles from intelligence analysis', token),
      ]);

      // C. Decision logging: POST to /api/brain for each price recommendation
      const runTimestamp = new Date().toISOString();
      const origin = new URL(request.url).origin;
      const decisionLogPromises = priceRecommendations.map(function(rec) {
        return fetch(origin + '/api/brain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': env.SYNC_SECRET || '' },
          body: JSON.stringify({
            action: 'log-decision',
            decision: {
              id: 'intel-run-' + Date.now() + '-' + rec.handle,
              timestamp: runTimestamp,
              type: 'price-recommendation',
              description: 'Recommend price change for ' + rec.handle,
              confidence: rec.confidenceScore,
              autoApplied: false,
              outcome: 'pending',
              relatedHandles: [rec.handle],
            },
          }),
        }).catch(function() {});
      });
      await Promise.allSettled(decisionLogPromises);

      // D. Intelligence run history: append summary to brain.history.intelligenceRuns
      const avgConfidence = priceRecommendations.length > 0
        ? Math.round((priceRecommendations.reduce(function(s, r) { return s + r.confidenceScore; }, 0) / priceRecommendations.length) * 100) / 100
        : 0;
      const topInsight = (parsed.insights || [])[0] || (parsed.trends || [])[0] || '';

      try {
        const freshBrainFile = await ghGet('data/brain.json', token).catch(() => null);
        if (freshBrainFile) {
          const freshBrain = JSON.parse(atob(freshBrainFile.content.replace(/\n/g, '')));
          if (!freshBrain.history) freshBrain.history = {};
          if (!Array.isArray(freshBrain.history.intelligenceRuns)) freshBrain.history.intelligenceRuns = [];
          freshBrain.history.intelligenceRuns.push({
            runAt: runTimestamp,
            productCount: products.length,
            recommendationCount: priceRecommendations.length,
            avgConfidence,
            topInsight,
          });
          // Keep last 30 runs
          freshBrain.history.intelligenceRuns = freshBrain.history.intelligenceRuns.slice(-30);
          await ghPut('data/brain.json', JSON.stringify(freshBrain, null, 2), freshBrainFile.sha, 'Intelligence run history: ' + runTimestamp.slice(0, 10), token);
        }
      } catch (_) {}

      return jsonResponse({ report });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
