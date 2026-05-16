/**
 * Synthesis Engine — multi-disciplinary convergence scoring for Tensor Works.
 * Applies 7 disciplinary models to all business data and produces a Convergence Score,
 * then uses Claude to synthesise cross-discipline insights into actionable recommendations.
 *
 * GET  → latest synthesis-report.json
 * POST → run full synthesis, save report, return results
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

// ─── Maths utilities ────────────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function linRegSlope(ys) {
  // simple linear regression slope over integer x indices 0..n-1
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Layer 1: Physics — Demand Wave Model ────────────────────────────────────

function physicsLayer(products, trends, analytics) {
  const daily = (trends?.daily || []).slice(-14);
  const allSessions = daily.map(d => d.sessions || d.pageViews || 0);
  const recent7 = allSessions.slice(-7);
  const prior7 = allSessions.slice(0, 7);
  const recent7Avg = mean(recent7);
  const prior7Avg = mean(prior7);

  // Overall demand velocity (site-level proxy when no per-product view series)
  const overallVelocity = prior7Avg > 0 ? (recent7Avg - prior7Avg) / prior7Avg : 0;

  // Demand momentum: slope of the daily session series
  const momentum = linRegSlope(allSessions);

  // Wave amplitude: coefficient of variation of sessions (volatility)
  const sessionsAll = allSessions.length ? allSessions : [0];
  const amplitudeRaw = mean(sessionsAll) > 0 ? stddev(sessionsAll) / mean(sessionsAll) : 0;
  const amplitude = clamp(amplitudeRaw);

  // Per-product signals
  const productSignals = (products || []).map(p => {
    const price = parseFloat(p.priceIncGst || p.price || 0);
    const inStock = p.inStock !== false && (p.stockLevel === undefined || p.stockLevel > 0);
    // Proxy views from analytics session data — use price gravity as a weight
    const priceGravity = clamp(price > 0 ? Math.log10(Math.max(price, 1)) / 4 : 0);

    // Equilibrium: stock vs demand signal
    // inStock + high velocity = equilibrium; OOS + high velocity = opportunity; stock + low velocity = excess
    let equilibriumScore;
    if (!inStock && overallVelocity > 0) equilibriumScore = 1.0; // opportunity
    else if (inStock && overallVelocity > 0.05) equilibriumScore = 0.8; // balanced
    else if (inStock && overallVelocity <= 0) equilibriumScore = 0.2; // possible excess
    else equilibriumScore = 0.5;

    return {
      handle: p.handle || p.title,
      title: p.title,
      price,
      priceGravity,
      equilibriumScore,
      velocity: overallVelocity, // site-level proxy
    };
  });

  // Top 3 velocity leaders: products with highest inferred demand (lowest gravity = fastest)
  const velocityLeaders = [...productSignals]
    .sort((a, b) => b.equilibriumScore - a.equilibriumScore || a.priceGravity - b.priceGravity)
    .slice(0, 3)
    .map(p => ({
      type: 'velocity_leader',
      product: p.handle,
      price: p.price,
      equilibriumScore: p.equilibriumScore,
      velocity: p.velocity,
    }));

  const avgEquilibrium = productSignals.length
    ? mean(productSignals.map(p => p.equilibriumScore))
    : 0.4;

  // Score: blend equilibrium, velocity direction, stability
  const velocityNorm = clamp(0.5 + overallVelocity * 0.5); // 0.5 = flat
  const stabilityBonus = clamp(1 - amplitude) * 0.1;
  const score = clamp(avgEquilibrium * 0.6 + velocityNorm * 0.3 + stabilityBonus);

  return {
    score,
    signals: velocityLeaders,
    insights: {
      overallVelocity,
      momentum,
      amplitude,
      avgEquilibrium,
      velocityNorm,
      productCount: productSignals.length,
    },
  };
}

// ─── Layer 2: Psychology — Pricing Psychology & Buyer Behaviour ───────────────

function psychologyLayer(products, analytics, quotes, brain) {
  const productList = products || [];
  const quoteList = (quotes?.quotes || quotes || []);
  const leadList = []; // leads handled in CB layer; we access via quotes here

  // Charm Pricing Audit
  const charmScores = productList.map(p => {
    const price = parseFloat(p.priceIncGst || p.price || 0);
    if (!price) return 0.5; // unknown
    const cents = Math.round(price % 100);
    const units = Math.round(price % 10);
    if (cents === 99) return 1.0;
    if (units === 9) return 0.8;
    if (price % 5 === 0) return 0.3;
    return 0.6;
  });
  const avgCharmScore = charmScores.length ? mean(charmScores) : 0.5;

  // Charm pricing candidates (not using .99 or .9 endings)
  const charmCandidates = productList
    .map((p, i) => ({ p, score: charmScores[i] }))
    .filter(({ score }) => score < 0.6)
    .map(({ p }) => ({
      type: 'charm_pricing_candidate',
      product: p.handle || p.title,
      currentPrice: parseFloat(p.priceIncGst || p.price || 0),
      suggestion: 'Adjust price to end in .99 or .95 for psychological impact',
    }));

  // Price Anchoring Potential
  const anchorCandidates = productList.filter(p => {
    const price = parseFloat(p.priceIncGst || p.price || 0);
    return price >= 5000 && !p.compareAtPrice && !p.rrp;
  });

  // Loss Aversion Score
  const pricingSkill = brain?.skills?.pricing || '';
  const pricingSkillStr = typeof pricingSkill === 'string' ? pricingSkill : JSON.stringify(pricingSkill);
  const lossAversionScore = /save|off|discount/i.test(pricingSkillStr) ? 0.9 : 0.3;

  // B2B Decision Stage Distribution
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Leads via brain history proxy or 0
  const recentLeads = 0; // will be computed more accurately in CB layer
  const awarenessScore = clamp(recentLeads / 10);

  const draftSentQuotes = quoteList.filter(q => ['draft', 'sent'].includes(q.status)).length;
  const decisionQuotes = quoteList.filter(q => ['viewed', 'accepted'].includes(q.status)).length;
  const considerationScore = clamp(draftSentQuotes / 5);
  const decisionScore = clamp(decisionQuotes / 3);
  const buyerJourneyHealth = clamp(awarenessScore * 0.3 + considerationScore * 0.4 + decisionScore * 0.3);

  // Cognitive Price Band Analysis
  const bands = { lt1k: 0, k1to5k: 0, k5to20k: 0, gt20k: 0 };
  productList.forEach(p => {
    const price = parseFloat(p.priceIncGst || p.price || 0);
    if (price < 1000) bands.lt1k++;
    else if (price < 5000) bands.k1to5k++;
    else if (price < 20000) bands.k5to20k++;
    else bands.gt20k++;
  });
  const bandValues = Object.values(bands);
  const maxBandCount = Math.max(...bandValues, 1);
  // Simple alignment: if most products are in mid-tier (where B2B engagement usually is), good alignment
  const midTierDominant = (bands.k1to5k + bands.k5to20k) >= (bands.lt1k + bands.gt20k);
  const bandAlignmentScore = midTierDominant ? 0.75 : 0.45;

  const score = clamp((avgCharmScore * 0.35 + buyerJourneyHealth * 0.35 + lossAversionScore * 0.2 + bandAlignmentScore * 0.1));

  const signals = [
    ...charmCandidates.slice(0, 5),
    ...anchorCandidates.slice(0, 3).map(p => ({
      type: 'anchor_candidate',
      product: p.handle || p.title,
      price: parseFloat(p.priceIncGst || p.price || 0),
      suggestion: 'Add RRP/compareAt price to create anchor effect',
    })),
  ];

  return {
    score,
    signals,
    insights: {
      avgCharmScore,
      lossAversionScore,
      buyerJourneyHealth,
      bandAlignmentScore,
      anchorCandidates: anchorCandidates.length,
      priceBands: bands,
    },
  };
}

// ─── Layer 3: Biology — Evolutionary Fitness Indicators ───────────────────────

function biologyLayer(brain, trends, quotes, analytics, products, compPrices) {
  const brainData = brain || {};

  // Adaptation Rate
  const intelligenceRuns = brainData.history?.intelligenceRuns?.length || 0;
  const anomaliesActedOn = (brainData.history?.anomaliesDetected || []).filter(a => a.suggestedAction).length;
  const adaptationRate = clamp(intelligenceRuns * 0.05 + anomaliesActedOn * 0.02);

  // Fitness Score
  const dataQuality = clamp(brainData.meta?.dataQualityScore || 0);
  const learningConfidence = clamp(brainData.meta?.learningConfidence || 0);
  const pricingSkillDepth = brainData.skills?.pricing ? 0.8 : 0.2;
  const competitorAwareness = brainData.skills?.competitors ? 0.7 : 0.2;
  const fitness = clamp(
    dataQuality * 0.25 +
    learningConfidence * 0.25 +
    pricingSkillDepth * 0.25 +
    competitorAwareness * 0.25
  );

  // Population Diversity
  const productList = products || [];
  const categories = new Set(productList.map(p => p.category || p.productType || 'unknown')).size;
  const diversityScore = clamp(categories / 5);

  // Evolutionary Pressure
  const compProducts = compPrices?.products || [];
  const competitorCount = compProducts.filter(p => p.competitors?.length > 0).length;
  const pressure = clamp(competitorCount / 10);

  // Survival Signals
  const quoteList = quotes?.quotes || quotes || [];
  const conversionExists = quoteList.filter(q => q.status === 'accepted').length > 0;
  const revenueSignals = brainData.patterns?.priceElasticityByCategory
    ? Object.keys(brainData.patterns.priceElasticityByCategory).length
    : 0;

  // Adaptation gaps as signals
  const adaptationGaps = [];
  if (!brainData.skills?.pricing) adaptationGaps.push({ type: 'adaptation_gap', area: 'pricing', message: 'No pricing skill established in brain — run intelligence to build pricing knowledge' });
  if (!brainData.skills?.competitors) adaptationGaps.push({ type: 'adaptation_gap', area: 'competitors', message: 'No competitor awareness skill in brain — load competitor prices to improve awareness' });
  if (intelligenceRuns < 5) adaptationGaps.push({ type: 'adaptation_gap', area: 'intelligence_runs', message: `Only ${intelligenceRuns} intelligence runs recorded — more runs improve fitness` });
  if (!conversionExists) adaptationGaps.push({ type: 'adaptation_gap', area: 'conversion', message: 'No accepted quotes detected — focus on moving prospects to decision stage' });

  // Overall score: fitness weighted by adaptation rate (higher adaptation = fitness matters more)
  const score = clamp(fitness * (0.6 + adaptationRate * 0.4) + diversityScore * 0.1 + pressure * 0.05);

  return {
    score,
    signals: adaptationGaps,
    insights: {
      adaptationRate,
      fitness,
      diversityScore,
      evolutionaryPressure: pressure,
      conversionExists,
      revenueSignals,
      intelligenceRuns,
      categories,
    },
  };
}

// ─── Layer 4: Mathematics — Statistical Inference ─────────────────────────────

function mathematicsLayer(products, trends, analytics, funnel) {
  const daily = (trends?.daily || []).slice(-30);
  const sessions30 = daily.map(d => d.sessions || d.pageViews || 0);
  const sessions7d = sessions30.slice(-7).reduce((a, b) => a + b, 0);
  const totalSessions = sessions30.reduce((a, b) => a + b, 0);
  const funnelEvents = funnel?.events || [];
  const productList = products || [];
  const quoteList = [];

  // Bayesian Confidence Update
  let posteriorConfidence = 0.5;
  if (sessions7d > 50) posteriorConfidence += 0.1;
  if ((trends?.daily || []).length >= 14) posteriorConfidence += 0.1;
  if (funnelEvents.length > 0) posteriorConfidence += 0.1;
  posteriorConfidence = clamp(posteriorConfidence);

  // Price-Demand Regression (band-based)
  const pricedProducts = productList.filter(p => parseFloat(p.priceIncGst || p.price || 0) > 0);
  const bands = [
    { label: '<$2k', min: 0, max: 2000, products: [] },
    { label: '$2k-$10k', min: 2000, max: 10000, products: [] },
    { label: '$10k+', min: 10000, max: Infinity, products: [] },
  ];
  pricedProducts.forEach(p => {
    const price = parseFloat(p.priceIncGst || p.price || 0);
    const band = bands.find(b => price >= b.min && price < b.max);
    if (band) band.products.push(p);
  });
  // Higher-price bands having fewer products is normal B2B — treat as expected elasticity
  const bandCounts = bands.map(b => b.products.length);
  const elasticityNormal = bandCounts[0] >= bandCounts[1] && bandCounts[1] >= bandCounts[2];
  const elasticityScore = elasticityNormal ? 0.7 : 0.3;

  // Z-Score Outlier Detection
  const prices = pricedProducts.map(p => parseFloat(p.priceIncGst || p.price || 0));
  const priceMean = mean(prices);
  const priceStddev = stddev(prices);
  const outliers = pricedProducts
    .map(p => {
      const price = parseFloat(p.priceIncGst || p.price || 0);
      const z = priceStddev > 0 ? (price - priceMean) / priceStddev : 0;
      return { handle: p.handle || p.title, price, z };
    })
    .filter(p => Math.abs(p.z) > 2);

  // Variance Score (session stability)
  const sessionVariance = mean(sessions30) > 0 ? stddev(sessions30) / mean(sessions30) : 1;
  const varianceScore = clamp(1 - sessionVariance);

  // Sample Adequacy
  const sampleScore = clamp(totalSessions / 200);

  const score = clamp((posteriorConfidence + elasticityScore + varianceScore + sampleScore) / 4);

  const signals = outliers.map(o => ({
    type: 'price_outlier',
    product: o.handle,
    price: o.price,
    zScore: Math.round(o.z * 100) / 100,
    message: `Price is ${Math.abs(o.z).toFixed(1)} standard deviations from mean ($${Math.round(priceMean)})`,
  }));

  return {
    score,
    signals,
    insights: {
      posteriorConfidence,
      elasticityScore,
      varianceScore,
      sampleScore,
      totalSessions,
      sessions7d,
      outlierCount: outliers.length,
      priceMean: Math.round(priceMean),
      priceStddev: Math.round(priceStddev),
      priceBandCounts: bands.map(b => ({ label: b.label, count: b.products.length })),
    },
  };
}

// ─── Layer 5: History — Pattern & Cycle Recognition ───────────────────────────

function historyLayer(trends, brain, analytics) {
  const daily = (trends?.daily || []);
  const weekly = (trends?.weekly || []).slice(-8);
  const brainData = brain || {};

  // Market Cycle Detection
  const weeklySessionCounts = weekly.map(w => w.sessions || w.pageViews || 0);
  let consecutivePositive = 0;
  let consecutiveNegative = 0;
  for (let i = 1; i < weeklySessionCounts.length; i++) {
    const growth = weeklySessionCounts[i] - weeklySessionCounts[i - 1];
    if (growth > 0) { consecutivePositive++; consecutiveNegative = 0; }
    else if (growth < 0) { consecutiveNegative++; consecutivePositive = 0; }
  }
  let marketCycle = 'stable';
  if (consecutivePositive >= 4) marketCycle = 'growth';
  else if (consecutiveNegative >= 2) marketCycle = 'contraction';
  const cycleScore = marketCycle === 'growth' ? 1.0 : marketCycle === 'stable' ? 0.7 : 0.3;

  // Seasonality Detection
  const dailyLast30 = daily.slice(-30);
  const dayBuckets = [[], [], [], [], [], [], []]; // Sun=0..Sat=6
  dailyLast30.forEach(d => {
    if (!d.date) return;
    const dow = new Date(d.date).getDay();
    dayBuckets[dow].push(d.sessions || d.pageViews || 0);
  });
  const dayAvgs = dayBuckets.map(b => b.length ? mean(b) : 0);
  const allDayAvg = mean(dayAvgs.filter(v => v > 0));
  const maxDay = Math.max(...dayAvgs);
  const minDay = Math.min(...dayAvgs.filter(v => v > 0), maxDay);
  const seasonalityStrength = allDayAvg > 0 ? clamp((maxDay - minDay) / allDayAvg) : 0;
  const peakDayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayAvgs.indexOf(maxDay)];

  // Precedent Matching
  const intelligenceRuns = brainData.history?.intelligenceRuns || [];
  const currentConfidence = brainData.meta?.learningConfidence || 0.5;
  const precedentRun = intelligenceRuns.find(r => r.confidenceScore >= currentConfidence);
  const precedentScore = precedentRun ? 0.7 : 0.4;
  const precedentMsg = precedentRun
    ? `Similar conditions on ${precedentRun.timestamp?.slice(0, 10)} — confidence ${(precedentRun.confidenceScore * 100).toFixed(0)}%`
    : 'No historical precedent found — establishing baseline';

  // Decision History Quality
  const decisionCount = brainData.decisionLog?.length || 0;
  const outcomedDecisions = (brainData.decisionLog || []).filter(d => d.outcome).length;
  const historyQualityScore = clamp(decisionCount * 0.05 + outcomedDecisions * 0.1);

  // Trend Momentum (site-level sessions: recent 7d vs prior 7d)
  const recentDays = daily.slice(-7).map(d => d.sessions || d.pageViews || 0);
  const priorDays = daily.slice(-14, -7).map(d => d.sessions || d.pageViews || 0);
  const recentAvg = mean(recentDays);
  const priorAvg = mean(priorDays);
  const momentumRaw = priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : 0;
  const trendMomentum = clamp(0.5 + momentumRaw * 0.5); // 0.5 = flat

  const score = clamp((cycleScore + seasonalityStrength + precedentScore + historyQualityScore + trendMomentum) / 5);

  const signals = [
    { type: 'market_cycle', cycle: marketCycle, cycleScore, message: `Business is in ${marketCycle} phase (${consecutivePositive} positive / ${consecutiveNegative} negative weeks)` },
    { type: 'seasonality', strength: Math.round(seasonalityStrength * 100) / 100, peakDay: peakDayName, message: `Peak traffic on ${peakDayName}; seasonality strength ${(seasonalityStrength * 100).toFixed(0)}%` },
    { type: 'precedent', found: !!precedentRun, message: precedentMsg },
  ];

  return {
    score,
    signals,
    insights: {
      marketCycle,
      cycleScore,
      seasonalityStrength,
      peakDay: peakDayName,
      precedentScore,
      historyQualityScore,
      trendMomentum,
      decisionCount,
      outcomedDecisions,
    },
  };
}

// ─── Layer 6: Consumer Behaviour — RFM and Journey Analysis ──────────────────

function consumerBehaviourLayer(analytics, leads, quotes, funnel) {
  const leadList = leads?.leads || leads || [];
  const quoteList = quotes?.quotes || quotes || [];
  const funnelEvents = funnel?.events || [];
  const now = Date.now();

  // Dates
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  // RFM Scoring
  const sortedLeads = [...leadList].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  const lastLeadDate = sortedLeads[0] ? new Date(sortedLeads[0].createdAt || sortedLeads[0].date) : null;
  const daysSinceLastLead = lastLeadDate ? (now - lastLeadDate.getTime()) / (24 * 60 * 60 * 1000) : Infinity;
  const recencyScore = daysSinceLastLead < 7 ? 1.0 : daysSinceLastLead < 30 ? 0.7 : daysSinceLastLead < 90 ? 0.4 : 0.1;

  const leads30d = leadList.filter(l => {
    const d = new Date(l.createdAt || l.date || 0).getTime();
    return d >= thirtyDaysAgo;
  }).length;
  const frequencyScore = clamp(leads30d / 10);

  const acceptedQuotes90d = quoteList.filter(q => {
    const d = new Date(q.createdAt || q.date || 0).getTime();
    return q.status === 'accepted' && d >= ninetyDaysAgo;
  });
  const monetaryValue = acceptedQuotes90d.reduce((s, q) => s + parseFloat(q.total || q.value || 0), 0);
  const monetaryScore = clamp(monetaryValue / 50000);

  const rfmScore = (recencyScore + frequencyScore + monetaryScore) / 3;

  // Buyer Journey Velocity
  const quotesWithTiming = quoteList.filter(q => q.sentAt && q.respondedAt);
  let velocityScore = 0.5;
  if (quotesWithTiming.length > 0) {
    const avgDays = mean(quotesWithTiming.map(q =>
      (new Date(q.respondedAt) - new Date(q.sentAt)) / (24 * 60 * 60 * 1000)
    ));
    velocityScore = clamp(1 - avgDays / 30);
  }

  // Multi-Touch Attribution
  const dailyAnalytics = analytics?.sessions || 0;
  const sessions7d = typeof dailyAnalytics === 'number' ? dailyAnalytics : 0;
  const leads7d = leadList.filter(l => {
    const d = new Date(l.createdAt || l.date || 0).getTime();
    return d >= sevenDaysAgo;
  }).length;
  let touchScore = 0.5;
  if (sessions7d > 0 && leads7d > 0) {
    const touchesPerLead = sessions7d / leads7d;
    touchScore = clamp(1 - touchesPerLead / 20);
  }

  // Funnel Health
  const recentFunnel = funnelEvents.filter(e => {
    const d = new Date(e.timestamp || e.date || 0).getTime();
    return d >= thirtyDaysAgo;
  });
  let funnelScore = 0.3;
  if (recentFunnel.length > 0) {
    const productViews = recentFunnel.filter(e => e.type === 'product-view' || e.event === 'product-view').length;
    const addToCarts = recentFunnel.filter(e => e.type === 'add-to-cart' || e.event === 'add-to-cart').length;
    const ratio = productViews > 0 ? (addToCarts / productViews) * 5 : 0;
    funnelScore = clamp(ratio);
  }

  // Engagement Depth
  const sessionList = analytics?.sessionList || analytics?.recentSessions || [];
  const engagementScore = sessionList.length > 0
    ? clamp(mean(sessionList.map(s => (s.productViews || []).length || s.pageViewCount || 1)) / 3)
    : 0.3;

  const score = clamp((rfmScore + velocityScore + touchScore + funnelScore + engagementScore) / 5);

  const signals = [];
  if (recencyScore < 0.4) signals.push({ type: 'rfm_alert', metric: 'recency', message: `No new leads in ${Math.round(daysSinceLastLead)} days — pipeline may be stalling` });
  if (monetaryScore < 0.2) signals.push({ type: 'rfm_alert', metric: 'monetary', message: 'Low accepted quote value in last 90d — focus on closing high-value deals' });
  if (funnelScore < 0.3) signals.push({ type: 'funnel_gap', message: 'Low funnel event data — consider adding cart/checkout tracking' });

  return {
    score,
    signals,
    insights: {
      rfmScore,
      recencyScore,
      frequencyScore,
      monetaryScore,
      velocityScore,
      touchScore,
      funnelScore,
      engagementScore,
      leads30d,
      daysSinceLastLead: Math.round(daysSinceLastLead === Infinity ? -1 : daysSinceLastLead),
      acceptedQuoteValue: monetaryValue,
    },
  };
}

// ─── Layer 7: Marketing — Campaign & Channel Effectiveness ───────────────────

function marketingLayer(brain, analytics, leads, quotes) {
  const brainData = brain || {};
  const leadList = leads?.leads || leads || [];
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Campaign Coverage
  const campaigns = brainData.skills?.campaigns || [];
  const campaignArr = Array.isArray(campaigns) ? campaigns : [];
  const coverageScore = clamp(campaignArr.length / 4);

  // Lead Source Diversity
  const sources = new Set(leadList.map(l => l.source || 'website'));
  const diversityScore = sources.size > 1 ? clamp(sources.size / 4) : 0.3;

  // Message-Market Fit
  const messageFitScore = brainData.skills?.masterDirective?.salesDirective ? 0.8 : 0.4;

  // Timing Optimisation
  const sessionList = analytics?.sessionList || analytics?.recentSessions || [];
  let timingScore = 0.4;
  if (sessionList.length > 0) {
    timingScore = 0.7;
  }
  // Also check if we have daily trends with hour info
  const peakHour = null; // hour data not always in trends; use presence signal

  // Campaign ROI Proxy
  const leads30d = leadList.filter(l => {
    const d = new Date(l.createdAt || l.date || 0).getTime();
    return d >= thirtyDaysAgo;
  }).length;
  const sessions30dProxy = (analytics?.sessions || 0);
  const leadsPerSession = sessions30dProxy > 0 ? leads30d / sessions30dProxy : 0;
  const roiProxy = clamp(leadsPerSession * 50);

  const score = clamp((coverageScore + diversityScore + messageFitScore + timingScore + roiProxy) / 5);

  const signals = [];
  if (coverageScore < 0.5) signals.push({ type: 'marketing_gap', area: 'campaigns', message: `Only ${campaignArr.length} campaigns defined — aim for at least 4 to cover all segments` });
  if (diversityScore <= 0.3) signals.push({ type: 'marketing_gap', area: 'lead_sources', message: 'All leads from single source (website) — diversify to LinkedIn, referral, outbound' });
  if (!brainData.skills?.masterDirective?.salesDirective) signals.push({ type: 'marketing_gap', area: 'messaging', message: 'No sales directive in brain — define master messaging to improve market fit' });

  return {
    score,
    signals,
    insights: {
      coverageScore,
      diversityScore,
      messageFitScore,
      timingScore,
      roiProxy,
      campaignCount: campaignArr.length,
      leadSources: [...sources],
      leads30d,
    },
  };
}

// ─── Claude Synthesis Call ────────────────────────────────────────────────────

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

// ─── Main Handler ─────────────────────────────────────────────────────────────

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
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return latest synthesis report ───────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/synthesis-report.json', token, null);
    if (!data) return jsonResponse({ success: true, report: null, message: 'No synthesis report yet — POST to generate one' });
    const latest = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ success: true, report: latest });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  // ── POST: run full synthesis ───────────────────────────────────────────────

  // Load all data sources in parallel
  const [productsRes, analyticsRes, compRes, trendsRes, brainRes, funnelRes, quotesRes, leadsRes, forexRes] = await Promise.all([
    loadJSON('data/products.json', token, []),
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/competitor-prices.json', token, { products: [] }),
    loadJSON('data/trends.json', token, { daily: [], weekly: [] }),
    loadJSON('data/brain.json', token, {}),
    loadJSON('data/funnel.json', token, { events: [] }),
    loadJSON('data/quotes.json', token, { quotes: [] }),
    loadJSON('data/leads.json', token, { leads: [] }),
    loadJSON('data/forex.json', token, { current: null, history: [] }),
  ]);

  const products = productsRes.data || [];
  const analytics = analyticsRes.data || { sessions: [] };
  const compPrices = compRes.data || { products: [] };
  const trends = trendsRes.data || { daily: [], weekly: [] };
  const brain = brainRes.data || {};
  const funnel = funnelRes.data || { events: [] };
  const quotes = quotesRes.data || { quotes: [] };
  const leads = leadsRes.data || { leads: [] };
  const forex = forexRes.data || { current: null, history: [] };

  // ── Compute all disciplinary layers ──────────────────────────────────────
  const physicsResult = physicsLayer(products, trends, analytics);
  const psychologyResult = psychologyLayer(products, analytics, quotes, brain);
  const biologyResult = biologyLayer(brain, trends, quotes, analytics, products, compPrices);
  const mathematicsResult = mathematicsLayer(products, trends, analytics, funnel);
  const historyResult = historyLayer(trends, brain, analytics);
  const cbResult = consumerBehaviourLayer(analytics, leads, quotes, funnel);
  const marketingResult = marketingLayer(brain, analytics, leads, quotes);

  // ── Convergence Score ─────────────────────────────────────────────────────
  const disciplineScores = {
    physics: physicsResult.score,
    psychology: psychologyResult.score,
    biology: biologyResult.score,
    mathematics: mathematicsResult.score,
    history: historyResult.score,
    consumerBehaviour: cbResult.score,
    marketing: marketingResult.score,
  };

  const weights = { physics: 0.12, psychology: 0.15, biology: 0.18, mathematics: 0.18, history: 0.12, consumerBehaviour: 0.13, marketing: 0.12 };
  const convergenceScore = Object.entries(disciplineScores).reduce((sum, [k, v]) => sum + v * weights[k], 0);

  // ── Flatten all signals ───────────────────────────────────────────────────
  const allSignals = [
    ...physicsResult.signals,
    ...psychologyResult.signals,
    ...biologyResult.signals,
    ...mathematicsResult.signals,
    ...historyResult.signals,
    ...cbResult.signals,
    ...marketingResult.signals,
  ].slice(0, 20);

  // ── Derive context metrics ────────────────────────────────────────────────
  const sessions7d = (trends.daily || []).slice(-7).reduce((s, d) => s + (d.sessions || d.pageViews || 0), 0);
  const quoteList = quotes.quotes || quotes || [];
  const leadList = leads.leads || leads || [];

  // ── Claude Synthesis ──────────────────────────────────────────────────────
  const claudeSystem = 'You are a senior business strategist. Using the quantitative analysis provided, synthesise insights into actionable B2B AI hardware sales strategy. Return ONLY valid JSON: { "executiveSummary": "string", "topOpportunities": [{ "opportunity": "string", "action": "string", "expectedImpact": "string", "timeframe": "immediate|short-term|long-term" }], "criticalRisks": [{ "risk": "string", "mitigation": "string" }], "convergenceInsight": "string", "recommendedFocus": "string" }';

  const claudeUserPayload = JSON.stringify({
    convergenceScore: Math.round(convergenceScore * 1000) / 1000,
    disciplineScores: Object.fromEntries(Object.entries(disciplineScores).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
    signals: allSignals,
    context: {
      products: products.length,
      sessions7d,
      quotes: quoteList.length,
      leads: leadList.length,
    },
  });

  let claudeResult;
  try {
    const raw = await callClaude(apiKey, claudeSystem, [{ role: 'user', content: claudeUserPayload }], 2048);
    claudeResult = parseJSON(raw);
  } catch (e) {
    // Graceful fallback
    claudeResult = {
      executiveSummary: 'Synthesis complete. Claude analysis unavailable: ' + e.message,
      topOpportunities: [],
      criticalRisks: [],
      convergenceInsight: 'Unable to generate cross-discipline insight at this time.',
      recommendedFocus: 'Review discipline scores and act on lowest-scoring areas first.',
    };
  }

  // ── Build report record ───────────────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const report = {
    success: true,
    convergenceScore: Math.round(convergenceScore * 1000) / 1000,
    disciplineScores: Object.fromEntries(Object.entries(disciplineScores).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
    executiveSummary: claudeResult.executiveSummary || '',
    topOpportunities: claudeResult.topOpportunities || [],
    criticalRisks: claudeResult.criticalRisks || [],
    convergenceInsight: claudeResult.convergenceInsight || '',
    recommendedFocus: claudeResult.recommendedFocus || '',
    allSignals,
    layerInsights: {
      physics: physicsResult.insights,
      psychology: psychologyResult.insights,
      biology: biologyResult.insights,
      mathematics: mathematicsResult.insights,
      history: historyResult.insights,
      consumerBehaviour: cbResult.insights,
      marketing: marketingResult.insights,
    },
    generatedAt,
  };

  // ── Prepend to synthesis-report.json, cap at 10 entries ──────────────────
  const { data: existing, sha: existingSha } = await loadJSON('data/synthesis-report.json', token, []);
  const history = Array.isArray(existing) ? existing : (existing ? [existing] : []);
  history.unshift(report);
  if (history.length > 10) history.splice(10);

  try {
    await ghPut(
      'data/synthesis-report.json',
      JSON.stringify(history, null, 2),
      existingSha,
      'Synthesis Engine run: convergence score ' + report.convergenceScore + ' — ' + generatedAt,
      token,
    );
  } catch (saveErr) {
    // Non-fatal — still return the result
    report._saveError = saveErr.message;
  }

  return jsonResponse(report);
}
