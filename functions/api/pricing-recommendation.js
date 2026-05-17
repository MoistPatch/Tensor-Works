/**
 * Pricing Recommendation Engine — AI-powered analysis using competitor data,
 * inventory pressure, margin targets, and market positioning.
 * POST: generate recommendation for a SKU
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks' },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}
async function loadJSON(path, token, fallback = null) {
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

async function callClaude(apiKey, system, messages, maxTokens = 3072, enableThinking = true) {
  const reqBody = {
    model: 'claude-opus-4-7',
    max_tokens: maxTokens,
    system,
    messages,
  };
  if (enableThinking) {
    reqBody.thinking = { type: 'enabled', budget_tokens: Math.floor(maxTokens * 0.45) };
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(reqBody),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Anthropic API error');
  const thinkingBlocks = (d.content || []).filter(b => b.type === 'thinking').map(b => b.thinking);
  const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('') || '';
  return { text, thinking: thinkingBlocks.join('\n\n') };
}

function parseJSON(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(clean);
}

// ── Deterministic pre-analysis ────────────────────────────────────────────────

function assessInventoryPressure(daysInStock) {
  if (daysInStock > 60) return { level: 'critical', factor: 0.85, label: 'Critical — 60+ days in stock' };
  if (daysInStock > 45) return { level: 'high', factor: 0.92, label: 'High — 45+ days in stock' };
  if (daysInStock > 30) return { level: 'medium', factor: 0.97, label: 'Medium — 30–45 days in stock' };
  if (daysInStock < 10) return { level: 'low', factor: 1.05, label: 'Low — scarcity signal (<10 days stock)' };
  return { level: 'normal', factor: 1.0, label: 'Normal velocity' };
}

function computeMargin(price, costExGst) {
  if (!price || !costExGst) return null;
  const priceExGst = price / 1.1;
  return (priceExGst - costExGst) / priceExGst;
}

function classifyCompetitorPosition(ourPrice, competitors) {
  const competitorPrices = competitors.filter(c => c.price).map(c => ({ competitor: c.competitor, price: c.price }));
  if (!competitorPrices.length || !ourPrice) return { undercutters: [], parity: [], premium: [] };

  const undercutters = competitorPrices.filter(c => c.price < ourPrice * 0.98);
  const parity = competitorPrices.filter(c => Math.abs(c.price - ourPrice) / ourPrice <= 0.02);
  const premium = competitorPrices.filter(c => c.price > ourPrice * 1.02);

  return {
    undercutters,
    parity,
    premium,
    lowestCompetitor: competitorPrices.sort((a, b) => a.price - b.price)[0] || null,
    highestCompetitor: competitorPrices.sort((a, b) => b.price - a.price)[0] || null,
    avgCompetitorPrice: competitorPrices.reduce((s, c) => s + c.price, 0) / competitorPrices.length,
    ourPercentile: competitorPrices.filter(c => c.price < ourPrice).length / competitorPrices.length,
  };
}

function generateDeterministicStrategies(params) {
  const { currentPrice, costOfGoods, inventoryPressure, competitorPositions, marginFloor } = params;
  const costExGst = costOfGoods || 0;
  const marginFloorPct = marginFloor || 0.15;

  const strategies = [];

  // Strategy 1: Hold
  const holdMargin = computeMargin(currentPrice, costExGst);
  strategies.push({
    strategy: 'Hold Position',
    price: currentPrice,
    margin: holdMargin,
    impact: 'Maintains current positioning. Natural velocity continues.',
    risk: inventoryPressure.level !== 'normal' ? `Stock pressure: ${inventoryPressure.label}` : null,
  });

  // Strategy 2: Competitive undercut (if being undercut)
  if (competitorPositions.undercutters.length > 0) {
    const lowestComp = competitorPositions.lowestCompetitor;
    const undercutPrice = Math.round(lowestComp.price * 0.99 / 50) * 50; // round to $50
    const undercutMargin = computeMargin(undercutPrice, costExGst);
    if (undercutMargin === null || undercutMargin >= marginFloorPct) {
      strategies.push({
        strategy: 'Undercut Leader',
        price: undercutPrice,
        margin: undercutMargin,
        impact: `1% below ${lowestComp.competitor} ($${lowestComp.price.toLocaleString('en-AU')}). Likely conversion lift 20–40%.`,
        risk: undercutMargin && undercutMargin < 0.20 ? 'Thin margin — may trigger price war' : null,
      });
    }
  }

  // Strategy 3: Bundle (preserve margin, obscure comparison)
  const bundlePrice = Math.round(currentPrice * 1.06 / 100) * 100;
  strategies.push({
    strategy: 'Bundle Premium',
    price: bundlePrice,
    bundlePrice,
    margin: computeMargin(bundlePrice, costExGst),
    impact: 'Bundle with accessories (PSU, cables, warranty). Harder to price-compare. AOV increase.',
    risk: null,
  });

  // Strategy 4: Inventory clearance (if high pressure)
  if (inventoryPressure.level === 'high' || inventoryPressure.level === 'critical') {
    const clearancePrice = Math.round(currentPrice * 0.93 / 50) * 50;
    const clearanceMargin = computeMargin(clearancePrice, costExGst);
    if (clearanceMargin === null || clearanceMargin >= marginFloorPct - 0.02) {
      strategies.push({
        strategy: 'Clearance Discount',
        price: clearancePrice,
        margin: clearanceMargin,
        impact: `7% reduction moves stock faster. ${inventoryPressure.label}.`,
        risk: clearanceMargin && clearanceMargin < marginFloorPct ? `Below ${Math.round(marginFloorPct * 100)}% margin floor` : null,
      });
    }
  }

  // Strategy 5: Scarcity premium (if low stock, we're competitive)
  if (inventoryPressure.level === 'low' && competitorPositions.undercutters.length === 0) {
    const premiumPrice = Math.round(currentPrice * 1.04 / 50) * 50;
    strategies.push({
      strategy: 'Scarcity Premium',
      price: premiumPrice,
      margin: computeMargin(premiumPrice, costExGst),
      impact: 'Low stock creates urgency. Competitors at parity or higher. Capture margin now.',
      risk: 'May slow velocity slightly',
    });
  }

  return strategies;
}

function computeConfidenceScore(params) {
  const { competitorData, daysInStock, currentPrice, costOfGoods } = params;
  let score = 0.4;

  const competitors = competitorData || [];
  const freshComps = competitors.filter(c => {
    if (!c.lastUpdated) return false;
    return Date.now() - new Date(c.lastUpdated).getTime() < 12 * 3600 * 1000;
  });

  if (freshComps.length >= 2) score += 0.25;
  else if (freshComps.length === 1) score += 0.12;
  else if (competitors.length > 0) score += 0.05;

  if (costOfGoods > 0) score += 0.15;
  if (daysInStock > 0) score += 0.1;
  if (currentPrice > 0) score += 0.05;

  const prices = competitors.map(c => c.price).filter(Boolean);
  if (prices.length >= 2) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / prices.length;
    const cv = Math.sqrt(variance) / avg;
    if (cv < 0.05) score += 0.05; // stable market
  }

  return Math.min(Math.round(score * 100) / 100, 0.97);
}

// ── Request handler ───────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }});
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const token = env.GITHUB_PAT;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const body = await request.json().catch(() => ({}));
  const {
    sku,
    currentPrice,
    costOfGoods,
    inventoryLevel = 0,
    daysInStock = 30,
    marginFloor = 0.15,
    competitorData = null,
  } = body;

  if (!sku) return jsonResponse({ error: 'sku is required' }, 400);
  if (!currentPrice) return jsonResponse({ error: 'currentPrice is required' }, 400);

  // Load competitor cache if not provided directly
  let competitors = competitorData;
  if (!competitors) {
    const { data: cache } = await loadJSON('data/competitor-intelligence.json', token, { skus: {} });
    competitors = cache?.skus?.[sku]?.competitors || [];
  }

  // Pre-analysis
  const inventoryPressure = assessInventoryPressure(daysInStock);
  const competitorPositions = classifyCompetitorPosition(currentPrice, competitors);
  const deterministicStrategies = generateDeterministicStrategies({
    currentPrice,
    costOfGoods,
    inventoryPressure,
    competitorPositions,
    marginFloor,
  });

  const confScore = computeConfidenceScore({ competitorData: competitors, daysInStock, currentPrice, costOfGoods });

  // Build Claude prompt
  const analysisPayload = {
    sku,
    currentPrice,
    costOfGoods,
    inventoryLevel,
    daysInStock,
    marginFloor,
    inventoryPressure: { level: inventoryPressure.level, label: inventoryPressure.label },
    competitors: competitors.slice(0, 10),
    competitorPositions: {
      undercutterCount: competitorPositions.undercutters.length,
      parityCount: competitorPositions.parity.length,
      premiumCount: competitorPositions.premium.length,
      lowestCompetitor: competitorPositions.lowestCompetitor,
      avgCompetitorPrice: Math.round(competitorPositions.avgCompetitorPrice || 0),
      ourPercentile: Math.round((competitorPositions.ourPercentile || 0) * 100),
    },
    deterministicStrategies,
  };

  const systemPrompt = `You are a pricing intelligence engine for Tensor Works, an Australian B2B AI hardware and GPU reseller.
Given market data and pre-computed strategies, produce a refined pricing recommendation with clear reasoning.
All prices are AUD inclusive of GST (10%). Margin floor is the minimum acceptable gross margin %.
Return ONLY valid JSON — no markdown fences.`;

  const userPrompt = `Analyse this pricing situation and recommend the optimal strategy.

Data:
${JSON.stringify(analysisPayload, null, 2)}

Return exactly this JSON structure:
{
  "recommendedPrice": 0,
  "reasoning": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "strategies": [
    {"strategy": "name", "price": 0, "margin": 0.0, "impact": "description", "risk": "or null"}
  ],
  "competitorPositions": {
    "undercutter": {"competitor": "", "price": 0} or null,
    "parity": {"competitor": "", "price": 0} or null,
    "premium": {"competitor": "", "price": 0} or null
  },
  "stockInsights": {
    "yourStockDays": 0,
    "recommendation": "text"
  },
  "confidenceScore": 0.0,
  "dataQualityNote": "text"
}`;

  let claudeResult;
  let thinkingOutput = '';

  try {
    const { text, thinking } = await callClaude(
      apiKey,
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      3072,
      true,
    );
    claudeResult = parseJSON(text);
    thinkingOutput = thinking;
  } catch (e) {
    // Graceful fallback — use deterministic output
    const sorted = deterministicStrategies.sort((a, b) => {
      const scoreA = (a.margin || 0) * (inventoryPressure.level === 'high' ? 0.5 : 1);
      const scoreB = (b.margin || 0) * (inventoryPressure.level === 'high' ? 0.5 : 1);
      return scoreB - scoreA;
    });
    claudeResult = {
      recommendedPrice: sorted[0]?.price || currentPrice,
      reasoning: [
        `Current price: A$${currentPrice.toLocaleString('en-AU')}`,
        `Inventory pressure: ${inventoryPressure.label}`,
        `${competitorPositions.undercutters.length} competitor(s) undercut us`,
        `Claude analysis unavailable: ${e.message}`,
      ],
      strategies: deterministicStrategies,
      competitorPositions: {
        undercutter: competitorPositions.lowestCompetitor || null,
        parity: competitorPositions.parity[0] || null,
        premium: competitorPositions.premium[0] || null,
      },
      stockInsights: { yourStockDays: daysInStock, recommendation: inventoryPressure.label },
      confidenceScore: confScore * 0.7,
      dataQualityNote: 'Deterministic fallback — Claude analysis unavailable',
    };
  }

  // Blend confidence scores
  const blendedConfidence = typeof claudeResult.confidenceScore === 'number'
    ? Math.min((claudeResult.confidenceScore + confScore) / 2, 0.97)
    : confScore;

  return jsonResponse({
    ...claudeResult,
    confidenceScore: blendedConfidence,
    thinking: thinkingOutput || null,
    meta: {
      sku,
      generatedAt: new Date().toISOString(),
      inventoryPressureLevel: inventoryPressure.level,
      competitorCount: competitors.length,
      deterministicStrategiesGenerated: deterministicStrategies.length,
    },
  });
}
