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
async function callClaude(apiKey, system, messages, maxTokens = 2048, enableThinking = false) {
  const reqBody = { model: 'claude-opus-4-7', max_tokens: maxTokens, system, messages };
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
function simulateStrategy(strategy, periods, periodType, marketEnv, baseProducts, gymConfig) {
  const timeline = [];
  let cumulativeRevenue = 0;
  let cumulativeLeads = 0;
  let cumulativeQuotes = 0;

  // Build simulation params from gym config with fallbacks
  const params = {
    priceElasticity:      gymConfig?.simulationParams?.priceElasticity      ?? -1.5,
    charmPricingLift:     gymConfig?.simulationParams?.charmPricingLift      ?? 0.08,
    baseLeadRate:         gymConfig?.simulationParams?.baseLeadRate          ?? 0.015,
    leadToQuoteRate:      gymConfig?.simulationParams?.leadToQuoteRate       ?? 0.40,
    quoteAcceptanceRate:  gymConfig?.simulationParams?.quoteAcceptanceRate   ?? 0.30,
    marketGrowthRate:     gymConfig?.simulationParams?.marketGrowthRate      ?? 0.02,
    eventProbability:     gymConfig?.simulationParams?.eventProbability      ?? 0.10,
    seasonalAmplitude:    gymConfig?.simulationParams?.seasonalAmplitude     ?? 0.25,
  };

  // Apply custom formula overrides
  for (const formula of (gymConfig?.formulas || [])) {
    if (!formula.active) continue;
    if (formula.type === 'price-elasticity' && formula.parameters?.elasticity != null) {
      params.priceElasticity = formula.parameters.elasticity;
    }
    if (formula.type === 'lead-rate' && formula.parameters?.rate != null) {
      params.baseLeadRate = formula.parameters.rate;
    }
    if (formula.type === 'conversion-rate' && formula.parameters?.leadToQuote != null) {
      params.leadToQuoteRate = formula.parameters.leadToQuote;
    }
  }

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
    const growthDemand = seasonalDemand * Math.pow(1 + params.marketGrowthRate, period);

    // 3. Random market event (stochastic shock)
    let eventMultiplier = 1;
    let eventName = null;
    if (Math.random() < params.eventProbability) {
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
    // Price elasticity of demand for B2B hardware
    const priceEffect = Math.pow(strategy.genes.pricingMultiplier, params.priceElasticity);

    // Charm pricing (e.g. $9,999 vs $10,000) boosts conversion
    const charmEffect = strategy.genes.charmPricing ? (1 + params.charmPricingLift) : 1.0;

    // Campaign frequency drives lead generation volume
    const freqMultiplier = { daily: 1.3, 'twice-weekly': 1.2, weekly: 1.0, fortnightly: 0.7 };
    const campaignEffect = freqMultiplier[strategy.genes.campaignFrequency] || 1.0;

    // Persuasive messaging frames improve conversion
    const frameEffect = ['loss-aversion', 'urgency', 'roi-focused'].includes(strategy.genes.messagingFrame) ? 1.15 : 1.0;

    // Penalty when competitor pressure is high and strategy isn't responding with urgency
    const competitorEffect = marketState.competitorPressure > 0.6 && strategy.genes.messagingFrame !== 'urgency' ? 0.85 : 1.0;

    // 5. Period outcome calculations
    const periodSessions = Math.round(adjustedDemand * priceEffect * charmEffect * competitorEffect);

    // B2B session-to-lead rate
    const leadRate = params.baseLeadRate * campaignEffect * frameEffect;
    const periodLeads = Math.round(periodSessions * leadRate);

    // Leads to formal quotes
    const periodQuotes = Math.round(periodLeads * params.leadToQuoteRate);

    // Quotes accepted
    const periodAccepted = Math.round(periodQuotes * params.quoteAcceptanceRate);

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
      // Step trace: full calculation breakdown for transparency
      stepTrace: {
        waveDemand: Math.round(waveDemand),
        seasonalMultiplier: Math.round(marketEnv.seasonalFactors.getSeasonalMultiplier(period, periodType) * 1000) / 1000,
        growthFactor: Math.round(Math.pow(1 + params.marketGrowthRate, period) * 1000) / 1000,
        eventName,
        eventMultiplier,
        adjustedDemand: Math.round(adjustedDemand),
        priceEffect: Math.round(priceEffect * 1000) / 1000,
        charmEffect,
        campaignEffect,
        frameEffect,
        competitorEffect,
        leadRate: Math.round(leadRate * 10000) / 10000,
        avgDealValue: Math.round(avgDealValue),
        marginPct: Math.round(estimatedMarginPct * 100),
        competitorPressure: Math.round(marketState.competitorPressure * 100),
      },
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

// ── Confidence scoring ────────────────────────────────────────────────────────
function computeStrategyConfidence(stratResult, isWinner, allResults, gymConfig) {
  const threshold = gymConfig?.confidenceThreshold ?? 0.95;

  const sum = stratResult.summary || {};
  const fitnessComponent    = Math.min(1, (sum.overallFitnessScore || 0));
  const resilienceComponent = sum.resilienceScore || 0;
  const growthComponent     = sum.growthTrajectory > 0 ? Math.min(1, sum.growthTrajectory + 0.5) : 0.3;
  const winnerComponent     = isWinner ? 1.0 : 0.3;

  // Revenue consistency: low variance = high confidence
  const revenues = (stratResult.timeline || []).map(t => t.revenueAUD || 0);
  const avgRev = revenues.reduce((a, b) => a + b, 0) / Math.max(revenues.length, 1);
  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avgRev, 2), 0) / Math.max(revenues.length, 1);
  const consistencyComponent = avgRev > 0 ? Math.max(0, 1 - Math.sqrt(variance) / avgRev) : 0;

  const score = (
    fitnessComponent    * 0.30 +
    resilienceComponent * 0.25 +
    growthComponent     * 0.20 +
    winnerComponent     * 0.15 +
    consistencyComponent* 0.10
  );

  return {
    score:          Math.round(score * 1000) / 1000,
    meetsThreshold: score >= threshold,
    threshold,
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

    const [productsRes, analyticsRes, compRes, gymResElite] = await Promise.all([
      loadJSON('data/products.json', token, []),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/competitor-prices.json', token, { products: [] }),
      loadJSON('data/gym-config.json', token, {
        formulas: [],
        simulationParams: {},
        confidenceThreshold: 0.95,
      }),
    ]);
    const gymConfig = gymResElite.data;

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
      simulateStrategy({ id: elite.id || ('elite-' + elite.fitnessScore), name: elite.name || 'Elite Strategy', genes: elite.genes }, periods, periodType, marketEnv, baseProducts, gymConfig)
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
    const [productsRes, analyticsRes, compRes, trendsRes, brainRes, evolutionRes, forexRes, gymRes] = await Promise.all([
      loadJSON('data/products.json', token, []),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/competitor-prices.json', token, { products: [] }),
      loadJSON('data/trends.json', token, { weekly: [] }),
      loadJSON('data/brain.json', token, {}),
      loadJSON('data/evolution.json', token, { elites: [] }),
      loadJSON('data/forex.json', token, { current: 0.65 }),
      loadJSON('data/gym-config.json', token, {
        formulas: [],
        simulationParams: {},
        confidenceThreshold: 0.95,
      }),
    ]);
    const gymConfig = gymRes.data;

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
      simulateStrategy(strategy, periods, periodType, marketEnv, baseProducts, gymConfig)
    );

    // Step 5: Call Claude for narrative analysis
    let claudeResult = {
      winner: { strategyId: strategyResults[0]?.strategyId || '', reason: 'Highest overall fitness score.' },
      keyInsights: [],
      marketConditionAdvice: '',
      riskWarnings: [],
      narrative: '',
    };

    let narrativeThinking = '';
    try {
      const { text: claudeRaw, thinking: claudeThinking } = await callClaude(
        apiKey,
        'You are a senior business analyst. Given simulation results for multiple strategies, explain which strategy wins and why, what market conditions drove the result, and what risks to watch. Return ONLY valid JSON: { "winner": { "strategyId": "string", "reason": "string" }, "keyInsights": [{ "insight": "string" }], "marketConditionAdvice": "string", "riskWarnings": [{ "risk": "string", "affectedStrategy": "string" }], "narrative": "string" }',
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
        4096,
        true,
      );
      claudeResult = parseJSON(claudeRaw);
      narrativeThinking = claudeThinking || '';
    } catch (e) {
      // Fall back gracefully: pick winner by fitness score
      const sorted = [...strategyResults].sort((a, b) => b.summary.overallFitnessScore - a.summary.overallFitnessScore);
      claudeResult.winner = {
        strategyId: sorted[0]?.strategyId || '',
        reason: 'Selected by highest overall fitness score (Claude analysis unavailable: ' + e.message + ').',
      };
      claudeResult.narrative = `The ${sorted[0]?.strategyName || 'top'} strategy achieved the highest simulated fitness score over ${periods} ${periodType}s. Claude narrative analysis was unavailable.`;
    }

    // Step 5b: Add confidence scores to each result
    const winnerId = claudeResult?.winner?.strategyId;
    strategyResults.forEach(r => {
      r.confidence = computeStrategyConfidence(r, r.strategyId === winnerId, strategyResults, gymConfig);
    });

    // Only recommend strategies that meet the confidence threshold
    const recommendations = strategyResults
      .filter(r => r.confidence.meetsThreshold)
      .sort((a, b) => b.confidence.score - a.confidence.score)
      .map(r => ({
        strategyId: r.strategyId,
        strategyName: r.strategyName,
        confidenceScore: r.confidence.score,
        totalRevenueAUD: r.summary.totalRevenueAUD,
        genes: r.genes,
      }));

    // Step 6: Build run record and save
    const runRecord = {
      runId: 'tsim-' + Date.now(),
      simulatedAt: new Date().toISOString(),
      periods,
      periodType,
      strategiesCompared: strategies.length,
      // Abbreviated results for storage (first 4 periods only, no stepTrace to save space)
      results: strategyResults.map(s => ({
        ...s,
        timeline: s.timeline.slice(0, 4).map(t => { const { stepTrace: _, ...rest } = t; return rest; }),
      })),
      winner: claudeResult.winner,
      insights: claudeResult.keyInsights,
      narrative: claudeResult.narrative,
      riskWarnings: claudeResult.riskWarnings,
      recommendations,
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
      narrativeThinking: narrativeThinking || null,
      strategyResults: strategyResults.map(s => ({ ...s })),  // full timelines + stepTraces in response
      insights: claudeResult.keyInsights,
      riskWarnings: claudeResult.riskWarnings,
      recommendations,
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
