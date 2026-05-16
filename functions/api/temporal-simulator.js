/**
 * Temporal Strategy Simulator — runs strategies forward through simulated TIME,
 * modelling how market conditions, competitor responses, seasonal cycles,
 * and strategy effects evolve over a simulated period of weeks/months.
 *
 * GET:  Return data/temporal-simulations.json (last 10 runs, summary only).
 * POST action: "run"          — simulate strategies over N periods.
 * POST action: "compare-elite" — fetch elite strategies from evolution.json and compare.
 */

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

// ── Default baseline strategies ──────────────────────────────────────────────
const DEFAULT_STRATEGIES = [
  {
    id: 'baseline-conservative',
    name: 'Conservative Hold',
    genes: {
      pricingMultiplier: 1.00,
      charmPricing: false,
      anchoringEnabled: false,
      discountDepth: 0,
      campaignType: 'educational',
      messagingFrame: 'trust',
      targetSegment: 'all',
      campaignFrequency: 'weekly',
      launchDayOfWeek: 'tuesday',
      followUpTiming: 3,
      focusCategory: 'all',
      bundlingEnabled: false,
      stockUrgencyThreshold: 0.2,
    },
  },
  {
    id: 'baseline-aggressive',
    name: 'Aggressive Growth',
    genes: {
      pricingMultiplier: 0.95,
      charmPricing: true,
      anchoringEnabled: true,
      discountDepth: 0.10,
      campaignType: 'urgency',
      messagingFrame: 'loss-aversion',
      targetSegment: 'enterprise',
      campaignFrequency: 'twice-weekly',
      launchDayOfWeek: 'tuesday',
      followUpTiming: 1,
      focusCategory: 'gpu',
      bundlingEnabled: true,
      stockUrgencyThreshold: 0.3,
    },
  },
  {
    id: 'baseline-relationship',
    name: 'Relationship Building',
    genes: {
      pricingMultiplier: 1.02,
      charmPricing: true,
      anchoringEnabled: true,
      discountDepth: 0.05,
      campaignType: 'relationship',
      messagingFrame: 'roi-focused',
      targetSegment: 'government',
      campaignFrequency: 'weekly',
      launchDayOfWeek: 'wednesday',
      followUpTiming: 5,
      focusCategory: 'all',
      bundlingEnabled: true,
      stockUrgencyThreshold: 0.1,
    },
  },
];

// ── Core simulation engine ────────────────────────────────────────────────────
function simulateStrategy(strategy, periods, periodType, marketEnv, baseProducts) {
  const timeline = [];
  let cumulativeRevenue = 0;
  let cumulativeLeads = 0;
  let cumulativeQuotes = 0;

  // Rolling market state (mutable across periods)
  const marketState = {
    demandPhase: marketEnv.demandPhase,
    competitorPressure: marketEnv.competitorPressure,
    forexRate: marketEnv.forexRate,
    currentEvents: [],
  };

  for (let period = 1; period <= periods; period++) {
    // 1. Advance demand phase
    marketState.demandPhase += marketEnv.demandFrequency * 2 * Math.PI / periods;

    // 2. Compute demand for this period
    const waveDemand = marketEnv.baseWeeklyDemand * (1 + marketEnv.demandAmplitude * Math.sin(marketState.demandPhase));
    const seasonalDemand = waveDemand * marketEnv.seasonalFactors.getSeasonalMultiplier(period, periodType);
    const growthDemand = seasonalDemand * Math.pow(1 + marketEnv.marketGrowthRate, period);

    // 3. Random market event (stochastic shock)
    let eventMultiplier = 1;
    let eventName = null;
    if (Math.random() < marketEnv.eventProbability) {
      const event = marketEnv.possibleEvents[Math.floor(Math.random() * marketEnv.possibleEvents.length)];
      eventMultiplier = event.demandMultiplier;
      eventName = event.name;
      // Competitor price drops persistently raise competitive pressure
      if (event.name === 'competitor-price-drop') {
        marketState.competitorPressure = Math.min(1, marketState.competitorPressure + 0.2);
      }
    }

    const adjustedDemand = growthDemand * eventMultiplier;

    // 4. Apply strategy genes
    // Price elasticity of demand for B2B hardware (-1.5)
    const priceElasticity = -1.5;
    const priceEffect = Math.pow(strategy.genes.pricingMultiplier, priceElasticity);

    // Charm pricing (e.g. $9,999 vs $10,000) boosts conversion ~8%
    const charmEffect = strategy.genes.charmPricing ? 1.08 : 1.0;

    // Campaign frequency drives lead generation volume
    const freqMultiplier = { daily: 1.3, 'twice-weekly': 1.2, weekly: 1.0, fortnightly: 0.7 };
    const campaignEffect = freqMultiplier[strategy.genes.campaignFrequency] || 1.0;

    // Persuasive messaging frames improve conversion
    const frameEffect = ['loss-aversion', 'urgency', 'roi-focused'].includes(strategy.genes.messagingFrame) ? 1.15 : 1.0;

    // Penalty when competitor pressure is high and strategy isn't responding with urgency
    const competitorEffect = marketState.competitorPressure > 0.6 && strategy.genes.messagingFrame !== 'urgency' ? 0.85 : 1.0;

    // 5. Period outcome calculations
    const periodSessions = Math.round(adjustedDemand * priceEffect * charmEffect * competitorEffect);

    // B2B session-to-lead rate: typically 1–2%
    const baseLeadRate = 0.015;
    const leadRate = baseLeadRate * campaignEffect * frameEffect;
    const periodLeads = Math.round(periodSessions * leadRate);

    // ~40% of leads progress to formal quotes
    const periodQuotes = Math.round(periodLeads * 0.4);

    // ~30% of quotes accepted
    const periodAccepted = Math.round(periodQuotes * 0.3);

    // Average deal value: use real product prices or default AUD 15,000 for GPU/AI hardware
    const pricedProducts = baseProducts.filter(p => p.priceIncGst);
    const avgProductPrice = pricedProducts.length > 0
      ? pricedProducts.reduce((s, p) => s + p.priceIncGst, 0) / pricedProducts.length
      : 15000;
    const avgDealValue = avgProductPrice * strategy.genes.pricingMultiplier * (1 - (strategy.genes.discountDepth || 0));
    const periodRevenue = periodAccepted * avgDealValue;

    // Gross margin estimate: 25% baseline minus any discount depth
    const estimatedMarginPct = 0.25 - (strategy.genes.discountDepth || 0);
    const periodMargin = periodRevenue * Math.max(0.05, estimatedMarginPct);

    cumulativeRevenue += periodRevenue;
    cumulativeLeads += periodLeads;
    cumulativeQuotes += periodQuotes;

    timeline.push({
      period,
      periodLabel: `${periodType} ${period}`,
      marketDemand: Math.round(adjustedDemand),
      sessions: periodSessions,
      leads: periodLeads,
      quotes: periodQuotes,
      acceptedDeals: periodAccepted,
      revenueAUD: Math.round(periodRevenue),
      marginAUD: Math.round(periodMargin),
      event: eventName,
      competitorPressure: Math.round(marketState.competitorPressure * 100),
    });
  }

  // Strategy-level summary metrics
  const avgRevenue = cumulativeRevenue / periods;
  const peakRevenue = Math.max(...timeline.map(t => t.revenueAUD));
  const troughRevenue = Math.min(...timeline.map(t => t.revenueAUD));
  const resilience = troughRevenue / Math.max(peakRevenue, 1);
  const growthTrajectory = (timeline[timeline.length - 1].revenueAUD - timeline[0].revenueAUD) / Math.max(timeline[0].revenueAUD, 1);

  return {
    strategyId: strategy.id,
    strategyName: strategy.name || strategy.id,
    genes: strategy.genes,
    totalPeriods: periods,
    periodType,
    summary: {
      totalRevenueAUD: Math.round(cumulativeRevenue),
      totalLeads: cumulativeLeads,
      totalQuotes: cumulativeQuotes,
      avgRevenuePerPeriodAUD: Math.round(avgRevenue),
      peakRevenueAUD: peakRevenue,
      troughRevenueAUD: troughRevenue,
      resilienceScore: Math.round(resilience * 100) / 100,
      growthTrajectory: Math.round(growthTrajectory * 100) / 100,
      overallFitnessScore: Math.round(
        (avgRevenue / 100000 * 0.4 + resilience * 0.3 + Math.max(0, growthTrajectory) * 0.3) * 100
      ) / 100,
    },
    timeline,
  };
}

// ── Request handler ───────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return last 10 run summaries ──────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/temporal-simulations.json', token, { runs: [] });
    const runs = (data?.runs || []).slice(0, 10).map(r => ({
      runId: r.runId,
      simulatedAt: r.simulatedAt,
      periods: r.periods,
      periodType: r.periodType,
      strategiesCompared: r.strategiesCompared,
      winner: r.winner,
      narrative: r.narrative,
      // Summary per strategy only — no full timeline data
      results: (r.results || []).map(s => ({
        strategyId: s.strategyId,
        strategyName: s.strategyName,
        summary: s.summary,
      })),
    }));
    return jsonResponse({ runs });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const { action } = body;

  // ── POST action: compare-elite ─────────────────────────────────────────────
  if (action === 'compare-elite') {
    const evolutionRes = await loadJSON('data/evolution.json', token, { elites: [] });
    const elites = (evolutionRes.data?.elites || [])
      .sort((a, b) => (b.fitnessScore || 0) - (a.fitnessScore || 0))
      .slice(0, 3);

    if (elites.length === 0) {
      return jsonResponse({ error: 'No elite strategies found in evolution.json. Run the strategy-evolver first.' }, 400);
    }

    const [productsRes, analyticsRes, compRes] = await Promise.all([
      loadJSON('data/products.json', token, []),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/competitor-prices.json', token, { products: [] }),
    ]);

    const baseProducts = productsRes.data || [];
    const analytics = analyticsRes.data || {};
    const compProducts = (compRes.data?.products) || [];
    const sessions7d = (analytics.sessions || []).filter(s => {
      if (!s.timestamp) return false;
      return (Date.now() - new Date(s.timestamp).getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length;

    const marketEnv = buildMarketEnv(sessions7d, compProducts, null);
    const periods = 12;
    const periodType = 'week';

    const strategyResults = elites.map(elite =>
      simulateStrategy({ id: elite.id || ('elite-' + elite.fitnessScore), name: elite.name || 'Elite Strategy', genes: elite.genes }, periods, periodType, marketEnv, baseProducts)
    );

    // Sort by fitness
    strategyResults.sort((a, b) => b.summary.overallFitnessScore - a.summary.overallFitnessScore);

    return jsonResponse({
      success: true,
      source: 'evolution.json',
      elitesFound: elites.length,
      periods,
      periodType,
      strategyResults: strategyResults.map(s => ({ ...s })),
      topStrategy: strategyResults[0]
        ? { strategyId: strategyResults[0].strategyId, strategyName: strategyResults[0].strategyName, summary: strategyResults[0].summary }
        : null,
    });
  }

  // ── POST action: run ───────────────────────────────────────────────────────
  if (action === 'run' || !action) {
    const periods = typeof body.periods === 'number' && body.periods > 0 ? Math.min(body.periods, 52) : 12;
    const periodType = body.periodType === 'month' ? 'month' : 'week';
    const strategies = Array.isArray(body.strategies) && body.strategies.length > 0
      ? body.strategies
      : DEFAULT_STRATEGIES;

    // Step 1: Load baseline state
    const [productsRes, analyticsRes, compRes, trendsRes, brainRes, evolutionRes, forexRes] = await Promise.all([
      loadJSON('data/products.json', token, []),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/competitor-prices.json', token, { products: [] }),
      loadJSON('data/trends.json', token, { weekly: [] }),
      loadJSON('data/brain.json', token, {}),
      loadJSON('data/evolution.json', token, { elites: [] }),
      loadJSON('data/forex.json', token, { current: 0.65 }),
    ]);

    const baseProducts = productsRes.data || [];
    const analytics = analyticsRes.data || {};
    const compProducts = (compRes.data?.products) || [];

    // Sessions in last 7 days as baseline weekly demand signal
    const sessions7d = (analytics.sessions || []).filter(s => {
      if (!s.timestamp) return false;
      return (Date.now() - new Date(s.timestamp).getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length;

    // Step 2: Define market environment
    const marketEnv = buildMarketEnv(sessions7d, compProducts, forexRes.data);

    // Step 3: Simulate each strategy
    const strategyResults = strategies.map(strategy =>
      simulateStrategy(strategy, periods, periodType, marketEnv, baseProducts)
    );

    // Step 5: Call Claude for narrative analysis
    let claudeResult = {
      winner: { strategyId: strategyResults[0]?.strategyId || '', reason: 'Highest overall fitness score.' },
      keyInsights: [],
      marketConditionAdvice: '',
      riskWarnings: [],
      narrative: '',
    };

    try {
      const claudeRaw = await callClaude(
        apiKey,
        'You are a business strategy analyst. Given simulation results for multiple strategies trialled over time, identify the winner and explain WHY it outperforms using the multi-disciplinary framework (physics demand waves, psychology of pricing, biological fitness, historical patterns, consumer behaviour, marketing principles). Return ONLY valid JSON: { "winner": { "strategyId": "string", "reason": "string" }, "keyInsights": [{ "insight": "string", "discipline": "string" }], "marketConditionAdvice": "string (what market conditions favour which strategy)", "riskWarnings": [{ "risk": "string", "affectedStrategy": "string" }], "narrative": "string (2-3 sentence plain English summary for the business owner)" }',
        [{
          role: 'user',
          content: JSON.stringify({
            strategies: strategyResults.map(s => ({
              id: s.strategyId,
              name: s.strategyName,
              summary: s.summary,
              genes: s.genes,
            })),
            periods,
            periodType,
            marketConditions: {
              baseWeeklyDemand: marketEnv.baseWeeklyDemand,
              marketGrowthRate: marketEnv.marketGrowthRate,
            },
          }),
        }],
        2048
      );
      claudeResult = parseJSON(claudeRaw);
    } catch (e) {
      // Fall back gracefully: pick winner by fitness score
      const sorted = [...strategyResults].sort((a, b) => b.summary.overallFitnessScore - a.summary.overallFitnessScore);
      claudeResult.winner = {
        strategyId: sorted[0]?.strategyId || '',
        reason: 'Selected by highest overall fitness score (Claude analysis unavailable: ' + e.message + ').',
      };
      claudeResult.narrative = `The ${sorted[0]?.strategyName || 'top'} strategy achieved the highest simulated fitness score over ${periods} ${periodType}s. Claude narrative analysis was unavailable.`;
    }

    // Step 6: Build run record and save
    const runRecord = {
      runId: 'tsim-' + Date.now(),
      simulatedAt: new Date().toISOString(),
      periods,
      periodType,
      strategiesCompared: strategies.length,
      // Abbreviated results for storage (first 4 periods only)
      results: strategyResults.map(s => ({ ...s, timeline: s.timeline.slice(0, 4) })),
      fullTimelines: strategyResults.reduce((acc, s) => { acc[s.strategyId] = s.timeline; return acc; }, {}),
      winner: claudeResult.winner,
      insights: claudeResult.keyInsights,
      narrative: claudeResult.narrative,
      riskWarnings: claudeResult.riskWarnings,
    };

    const simStore = await loadJSON('data/temporal-simulations.json', token, { runs: [] });
    const runs = [runRecord, ...(simStore.data?.runs || [])].slice(0, 10);
    await ghPut(
      'data/temporal-simulations.json',
      JSON.stringify({ runs }, null, 2),
      simStore.sha,
      'chore: temporal-simulation ' + runRecord.runId,
      token
    );

    return jsonResponse({
      success: true,
      runId: runRecord.runId,
      winner: claudeResult.winner,
      narrative: claudeResult.narrative,
      strategyResults: strategyResults.map(s => ({ ...s })),  // full timelines in response
      insights: claudeResult.keyInsights,
    });
  }

  return jsonResponse({ error: 'Unknown action. Use: run | compare-elite' }, 400);
}

// ── Market environment factory ────────────────────────────────────────────────
function buildMarketEnv(sessions7d, compProducts, forexData) {
  return {
    baseWeeklyDemand: sessions7d || 50,
    demandPhase: 0,
    demandFrequency: 0.25,
    demandAmplitude: 0.3,

    competitorPressure: compProducts.length > 0 ? 0.5 : 0.2,
    forexRate: forexData?.current || 0.65,
    marketGrowthRate: 0.02,

    seasonalFactors: {
      // B2B AI hardware peaks: Q1 budget deployment, Q3 year-end push
      getSeasonalMultiplier(period, periodType) {
        if (periodType === 'week') {
          // Sinusoidal with peaks near week 4 (Q1) and week 10 (Q3)
          const angle = (period / 13) * 2 * Math.PI;
          return 1 + 0.25 * Math.sin(angle + Math.PI / 6);
        }
        // Monthly: 6-month cycles
        return 1 + 0.2 * Math.sin((period / 6) * Math.PI);
      },
    },

    eventProbability: 0.1,
    possibleEvents: [
      { name: 'competitor-price-drop', demandMultiplier: 0.8,  description: 'Competitor cuts prices 15%' },
      { name: 'demand-surge',          demandMultiplier: 1.4,  description: 'Major AI announcement drives demand spike' },
      { name: 'supply-disruption',     demandMultiplier: 0.9,  description: 'GPU supply tightens globally' },
      { name: 'forex-shift',           demandMultiplier: 0.95, description: 'AUD weakens 5% vs USD' },
      { name: 'enterprise-freeze',     demandMultiplier: 0.7,  description: 'Enterprise IT budgets frozen' },
      { name: 'competitor-exit',       demandMultiplier: 1.3,  description: 'Competitor exits the market' },
    ],
  };
}
