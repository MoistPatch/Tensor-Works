/**
 * Strategy Evolver — genetic algorithm that maintains and evolves a population of
 * B2B AI hardware business strategies, competing on simulated fitness.
 *
 * POST actions: initialise | evolve | get-recommendation | record-outcome
 * GET: returns evolution.json summary
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
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g,''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

// ── Gene pools ────────────────────────────────────────────────────────────────

const GENE_POOLS = {
  // Pricing genes
  pricingMultiplier: [0.90, 0.95, 0.97, 1.00, 1.02, 1.05, 1.08, 1.10, 1.15],
  charmPricing: [true, false],
  anchoringEnabled: [true, false],
  discountDepth: [0, 0.03, 0.05, 0.08, 0.10, 0.12, 0.15],

  // Campaign genes
  campaignType: ['value-focused', 'urgency', 'authority', 'social-proof', 'educational', 'relationship'],
  messagingFrame: ['gain', 'loss-aversion', 'aspiration', 'fear-of-missing-out', 'trust', 'roi-focused'],
  targetSegment: ['enterprise', 'government', 'reseller', 'startup', 'research', 'all'],
  campaignFrequency: ['daily', 'twice-weekly', 'weekly', 'fortnightly'],

  // Timing genes
  launchDayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday'],
  followUpTiming: [1, 2, 3, 5, 7],

  // Product genes
  focusCategory: ['gpu', 'ai-hardware', 'networking', 'storage', 'all'],
  bundlingEnabled: [true, false],
  stockUrgencyThreshold: [0.1, 0.2, 0.3],
};

// ── Genetic operators ─────────────────────────────────────────────────────────

function randomGene(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

function initGenes() {
  const genes = {};
  for (const [key, pool] of Object.entries(GENE_POOLS)) genes[key] = randomGene(pool);
  return genes;
}

function crossover(parentA, parentB) {
  const genes = {};
  const keys = Object.keys(GENE_POOLS);
  const crossoverPoint = Math.floor(Math.random() * keys.length);
  keys.forEach((k, i) => { genes[k] = i < crossoverPoint ? parentA.genes[k] : parentB.genes[k]; });
  return genes;
}

function mutate(genes, mutationRate = 0.15) {
  const mutated = { ...genes };
  for (const [key, pool] of Object.entries(GENE_POOLS)) {
    if (Math.random() < mutationRate) mutated[key] = randomGene(pool);
  }
  return mutated;
}

function createStrategy(id, parentIds = [], generation = 0) {
  return {
    id,
    parentIds,
    generation,
    genes: {},
    fitnessScore: null,
    fitnessComponents: {},
    trialCount: 0,
    trialResults: [],
    createdAt: new Date().toISOString(),
    lastTrialedAt: null,
    status: 'untrialed',
  };
}

// ── Fitness function ──────────────────────────────────────────────────────────

function evaluateFitness(strategy, products, analytics, quotes, brain, forex) {
  const genes = strategy.genes;
  let score = 0;
  const components = {};

  // 1. Revenue potential (pricing gene × demand signal)
  const sessions7d = (analytics.sessions || []).filter(s => new Date(s.timestamp) > new Date(Date.now() - 7 * 86400000)).length;
  const demandStrength = Math.min(1, sessions7d / 100);
  const pricingFitness = genes.pricingMultiplier <= 1.05
    ? demandStrength * genes.pricingMultiplier
    : demandStrength * (2 - genes.pricingMultiplier);
  components.pricing = Math.max(0, Math.min(1, pricingFitness));

  // 2. Psychological fit — charm pricing helps conversion
  const charmBonus = genes.charmPricing ? 0.08 : 0;
  const anchorBonus = genes.anchoringEnabled ? 0.06 : 0;
  components.psychology = Math.min(1, 0.5 + charmBonus + anchorBonus + (genes.discountDepth > 0 ? 0.1 : 0));

  // 3. Campaign resonance — loss-aversion and urgency frames tend to work in B2B hardware
  const frameScores = { 'loss-aversion': 0.9, 'roi-focused': 0.85, 'urgency': 0.8, 'trust': 0.75, 'authority': 0.7, 'value-focused': 0.7, 'educational': 0.65, 'social-proof': 0.6, 'gain': 0.6, 'aspiration': 0.55, 'fear-of-missing-out': 0.5, 'relationship': 0.7 };
  const typeScores = { 'value-focused': 0.8, 'educational': 0.75, 'authority': 0.8, 'social-proof': 0.7, 'urgency': 0.75, 'relationship': 0.85 };
  components.campaign = ((frameScores[genes.messagingFrame] || 0.5) + (typeScores[genes.campaignType] || 0.6)) / 2;

  // 4. Segment fit — enterprise and government have higher ACV but longer cycles
  const segmentScores = {
    'enterprise': (quotes || []).filter(q => q.totalAUD > 20000).length > 0 ? 0.9 : 0.7,
    'government': 0.8,
    'reseller': 0.75,
    'startup': 0.6,
    'research': 0.7,
    'all': 0.65,
  };
  components.segment = segmentScores[genes.targetSegment] || 0.6;

  // 5. Timing fitness — B2B decisions peak mid-week
  const timingScores = { 'tuesday': 1.0, 'wednesday': 0.95, 'thursday': 0.85, 'monday': 0.7 };
  components.timing = timingScores[genes.launchDayOfWeek] || 0.7;

  // 6. Forex sensitivity — for USD-priced imports, timing matters
  const forexCurrent = forex && forex.current;
  const forexHistory = (forex && forex.history) || [];
  const forex7dAgo = forexHistory.find(h => new Date(h.timestamp) < new Date(Date.now() - 7 * 86400000));
  if (forexCurrent && forex7dAgo) {
    const forexChange = (forexCurrent - forex7dAgo.audUsd) / forex7dAgo.audUsd;
    const forexFit = genes.messagingFrame === 'urgency' && forexChange > 0.01 ? 1.0 : 0.7;
    components.forex = forexFit;
  } else {
    components.forex = 0.7;
  }

  // 7. Bundling potential
  components.bundling = genes.bundlingEnabled ? 0.8 : 0.6;

  // Weighted fitness (weights sum to 1.0)
  const weights = { pricing: 0.25, psychology: 0.15, campaign: 0.20, segment: 0.15, timing: 0.10, forex: 0.10, bundling: 0.05 };
  score = Object.entries(components).reduce((sum, [k, v]) => sum + v * (weights[k] || 0), 0);

  return { fitnessScore: Math.round(score * 1000) / 1000, fitnessComponents: components };
}

// ── Tournament selection ──────────────────────────────────────────────────────

function tournamentSelect(population, tournamentSize = 3) {
  const eligible = population.filter(s => s.fitnessScore !== null);
  if (eligible.length < 2) return null;
  const contestants = [];
  for (let i = 0; i < tournamentSize; i++) {
    contestants.push(eligible[Math.floor(Math.random() * eligible.length)]);
  }
  return contestants.reduce((best, s) => s.fitnessScore > best.fitnessScore ? s : best);
}

// ── Gene translation to human-readable English ────────────────────────────────

function humanReadableGenes(genes) {
  const descriptions = {};

  // Pricing
  const pm = genes.pricingMultiplier;
  if (pm < 1) descriptions.pricingMultiplier = `${Math.round((1 - pm) * 100)}% price discount from baseline`;
  else if (pm === 1) descriptions.pricingMultiplier = 'Baseline pricing (no premium or discount)';
  else descriptions.pricingMultiplier = `${Math.round((pm - 1) * 100)}% price premium over baseline`;

  descriptions.charmPricing = genes.charmPricing
    ? 'Use charm pricing (.95/.99 endings) to improve perceived value'
    : 'Use round-number pricing for straightforward B2B clarity';

  descriptions.anchoringEnabled = genes.anchoringEnabled
    ? 'Show RRP/compare-at prices to anchor buyer expectations'
    : 'No price anchoring — let the price stand alone';

  descriptions.discountDepth = genes.discountDepth === 0
    ? 'No discounts offered'
    : `Offer up to ${Math.round(genes.discountDepth * 100)}% discount when needed`;

  // Campaign
  const frameMap = {
    'loss-aversion': 'Frame as cost of inaction — what they lose by not buying',
    'roi-focused': 'Lead with ROI — show clear financial return on investment',
    'urgency': 'Create urgency — limited time or stock messaging',
    'trust': 'Build trust — references, certifications, track record',
    'authority': 'Establish authority — expert positioning and thought leadership',
    'value-focused': 'Lead with value — total cost of ownership and quality',
    'educational': 'Educate first — help prospects understand the problem space',
    'social-proof': 'Use social proof — case studies, logos, testimonials',
    'gain': 'Frame as gain — focus on what they will achieve',
    'aspiration': 'Appeal to aspiration — where they want to be',
    'fear-of-missing-out': 'FOMO messaging — competitors are already moving',
    'relationship': 'Relationship-led — long-term partnership approach',
  };
  descriptions.messagingFrame = frameMap[genes.messagingFrame] || genes.messagingFrame;

  const typeMap = {
    'value-focused': 'Value-focused campaign type',
    'urgency': 'Urgency-driven campaign type',
    'authority': 'Authority/expertise-led campaign type',
    'social-proof': 'Social proof campaign type',
    'educational': 'Educational content campaign type',
    'relationship': 'Relationship-building campaign type',
  };
  descriptions.campaignType = typeMap[genes.campaignType] || genes.campaignType;

  const segMap = {
    'enterprise': 'Target enterprise accounts (high ACV, longer cycles)',
    'government': 'Target government/public sector (stable, large contracts)',
    'reseller': 'Target resellers and channel partners',
    'startup': 'Target startups and scale-ups (faster decisions, lower ACV)',
    'research': 'Target research institutions and universities',
    'all': 'Broad targeting across all segments',
  };
  descriptions.targetSegment = segMap[genes.targetSegment] || genes.targetSegment;

  const freqMap = {
    'daily': 'Daily outreach cadence',
    'twice-weekly': 'Twice-weekly outreach cadence',
    'weekly': 'Weekly outreach cadence',
    'fortnightly': 'Fortnightly outreach cadence',
  };
  descriptions.campaignFrequency = freqMap[genes.campaignFrequency] || genes.campaignFrequency;

  // Timing
  descriptions.launchDayOfWeek = `Launch campaigns on ${genes.launchDayOfWeek.charAt(0).toUpperCase() + genes.launchDayOfWeek.slice(1)} for peak B2B engagement`;
  descriptions.followUpTiming = `Follow up ${genes.followUpTiming} day${genes.followUpTiming > 1 ? 's' : ''} after initial contact`;

  // Product
  const catMap = {
    'gpu': 'Focus on GPU products',
    'ai-hardware': 'Focus on AI accelerator hardware',
    'networking': 'Focus on networking equipment',
    'storage': 'Focus on storage solutions',
    'all': 'Promote full product catalogue',
  };
  descriptions.focusCategory = catMap[genes.focusCategory] || genes.focusCategory;

  descriptions.bundlingEnabled = genes.bundlingEnabled
    ? 'Enable product bundling to increase basket size'
    : 'Sell individual products — no bundling';

  descriptions.stockUrgencyThreshold = `Show "low stock" warning when stock drops below ${Math.round(genes.stockUrgencyThreshold * 100)}% of max`;

  return descriptions;
}

// ── Default evolution.json structure ─────────────────────────────────────────

const DEFAULT_EVOLUTION = {
  generation: 0,
  population: [],
  elites: [],
  graveyard: [],
  evolutionHistory: [],
  bestFitnessEver: 0,
  bestStrategyEver: null,
};

// ── Initialise population ────────────────────────────────────────────────────

function initialisePopulation(generation = 1, count = 12) {
  const population = [];
  for (let i = 0; i < count; i++) {
    const s = createStrategy('strat-' + Date.now() + '-' + i, [], generation);
    s.genes = initGenes();
    population.push(s);
  }
  return population;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: summary ───────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data: evo } = await loadJSON('data/evolution.json', token, DEFAULT_EVOLUTION);
    const pop = evo.population || [];
    const scored = pop.filter(s => s.fitnessScore !== null);
    const avgFitness = scored.length
      ? Math.round((scored.reduce((s, x) => s + x.fitnessScore, 0) / scored.length) * 1000) / 1000
      : 0;
    const sorted = [...pop].sort((a, b) => (b.fitnessScore || 0) - (a.fitnessScore || 0));
    const top3 = sorted.slice(0, 3);

    return jsonResponse({
      generation: evo.generation,
      populationSize: pop.length,
      avgFitness,
      bestFitness: evo.bestFitnessEver,
      elites: top3.map(s => ({ id: s.id, fitnessScore: s.fitnessScore, genes: s.genes })),
      evolutionHistory: (evo.evolutionHistory || []).slice(-10),
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // ── action: initialise ────────────────────────────────────────────────────
  if (action === 'initialise') {
    const { sha } = await loadJSON('data/evolution.json', token, null);
    const evo = { ...DEFAULT_EVOLUTION };
    evo.population = initialisePopulation(1, 12);
    evo.generation = 1;
    await ghPut('data/evolution.json', JSON.stringify(evo, null, 2), sha, 'Evolution: initialise population', token);
    return jsonResponse({ initialised: true, populationSize: 12 });
  }

  // ── action: evolve ────────────────────────────────────────────────────────
  if (action === 'evolve' || !action) {
    // Load all data in parallel
    const [evoRes, productsRes, analyticsRes, quotesRes, brainRes, forexRes] = await Promise.all([
      loadJSON('data/evolution.json', token, DEFAULT_EVOLUTION),
      loadJSON('data/products.json', token, []),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/quotes.json', token, []),
      loadJSON('data/brain.json', token, {}),
      loadJSON('data/forex.json', token, {}),
    ]);

    const evo = evoRes.data || { ...DEFAULT_EVOLUTION };
    const products = productsRes.data || [];
    const analytics = analyticsRes.data || { sessions: [] };
    const quotes = quotesRes.data || [];
    const brain = brainRes.data || {};
    const forex = forexRes.data || {};

    // Auto-initialise if empty
    let autoInitialised = false;
    if (!evo.population || evo.population.length === 0) {
      evo.population = initialisePopulation(1, 12);
      evo.generation = 1;
      autoInitialised = true;
    }

    // Evaluate fitness for all strategies (untrialed + active re-evaluation)
    const now = new Date().toISOString();
    const sessions7d = (analytics.sessions || []).filter(s => new Date(s.timestamp) > new Date(Date.now() - 7 * 86400000)).length;
    const quotesCount = (quotes || []).length;
    const forexRate = forex.current || null;

    for (const strategy of evo.population) {
      if (strategy.status === 'deprecated') continue; // skip culled
      const { fitnessScore, fitnessComponents } = evaluateFitness(strategy, products, analytics, quotes, brain, forex);
      strategy.fitnessScore = fitnessScore;
      strategy.fitnessComponents = fitnessComponents;
      strategy.lastTrialedAt = now;
      strategy.trialCount = (strategy.trialCount || 0) + 1;
      if (strategy.status === 'untrialed') strategy.status = 'active';

      const trialEntry = {
        trialedAt: now,
        fitnessScore,
        marketConditions: { sessions7d, quotesCount, forexRate },
      };
      strategy.trialResults = strategy.trialResults || [];
      strategy.trialResults.unshift(trialEntry);
      if (strategy.trialResults.length > 5) strategy.trialResults = strategy.trialResults.slice(0, 5);
    }

    // Sort by fitness descending
    evo.population.sort((a, b) => (b.fitnessScore || 0) - (a.fitnessScore || 0));

    // Mark top 3 as elites
    const activePop = evo.population.filter(s => s.status !== 'deprecated');
    activePop.forEach((s, i) => {
      if (i < 3) s.status = 'elite';
      else if (s.status === 'elite') s.status = 'active'; // demote ex-elites
    });

    // Mark bottom 3 as deprecated if population > 10
    if (activePop.length > 10) {
      const bottom3 = activePop.slice(-3);
      bottom3.forEach(s => { s.status = 'deprecated'; });
    }

    // Reproduction — fill up to 20
    let newCount = 0;
    const reproductionCandidates = evo.population.filter(s => s.status !== 'deprecated' && s.fitnessScore !== null);
    while (evo.population.filter(s => s.status !== 'deprecated').length < 20 && reproductionCandidates.length >= 2) {
      const parentA = tournamentSelect(reproductionCandidates);
      const parentB = tournamentSelect(reproductionCandidates);
      if (!parentA || !parentB || parentA.id === parentB.id) break;

      const childGenes = mutate(crossover(parentA, parentB), 0.15);
      const child = createStrategy('strat-' + (Date.now() + newCount), [parentA.id, parentB.id], evo.generation);
      child.genes = childGenes;
      evo.population.push(child);
      newCount++;
    }

    // Culling — if population > 20, remove bottom deprecated strategies and move to graveyard
    const deprecated = evo.population.filter(s => s.status === 'deprecated');
    if (evo.population.length > 20 && deprecated.length > 0) {
      const toRemove = deprecated.slice(-3);
      const removeIds = new Set(toRemove.map(s => s.id));
      evo.population = evo.population.filter(s => !removeIds.has(s.id));
      evo.graveyard = evo.graveyard || [];
      evo.graveyard.push(...toRemove.map(s => ({ ...s, buriedAt: now })));
      if (evo.graveyard.length > 50) evo.graveyard = evo.graveyard.slice(0, 50);
    }

    // Increment generation
    evo.generation = (evo.generation || 0) + 1;

    // Best ever tracking
    const currentBest = evo.population.reduce((best, s) => (s.fitnessScore || 0) > (best?.fitnessScore || 0) ? s : best, null);
    if (currentBest && currentBest.fitnessScore > (evo.bestFitnessEver || 0)) {
      evo.bestFitnessEver = currentBest.fitnessScore;
      evo.bestStrategyEver = { ...currentBest, capturedAt: now };
    }

    // Compute stats
    const scoredPop = evo.population.filter(s => s.fitnessScore !== null);
    const avgFitness = scoredPop.length
      ? Math.round((scoredPop.reduce((s, x) => s + x.fitnessScore, 0) / scoredPop.length) * 1000) / 1000
      : 0;
    const bestFitness = currentBest?.fitnessScore || 0;

    // Append evolution history
    evo.evolutionHistory = evo.evolutionHistory || [];
    evo.evolutionHistory.push({ generation: evo.generation, avgFitness, bestFitness, populationSize: evo.population.length, timestamp: now });
    if (evo.evolutionHistory.length > 100) evo.evolutionHistory = evo.evolutionHistory.slice(-100);

    // Save evolution.json
    await ghPut('data/evolution.json', JSON.stringify(evo, null, 2), evoRes.sha, `Evolution: generation ${evo.generation}`, token);

    const elites = evo.population.filter(s => s.status === 'elite').slice(0, 3);

    return jsonResponse({
      generation: evo.generation,
      populationSize: evo.population.length,
      avgFitness,
      bestFitness,
      elites: elites.map(s => ({ id: s.id, fitnessScore: s.fitnessScore, fitnessComponents: s.fitnessComponents, genes: s.genes })),
      newStrategies: newCount,
      autoInitialised,
    });
  }

  // ── action: get-recommendation ────────────────────────────────────────────
  if (action === 'get-recommendation') {
    const { data: evo } = await loadJSON('data/evolution.json', token, DEFAULT_EVOLUTION);
    const pop = evo.population || [];
    const sorted = [...pop].filter(s => s.fitnessScore !== null).sort((a, b) => b.fitnessScore - a.fitnessScore);
    const top3 = sorted.slice(0, 3);

    return jsonResponse({
      elites: top3.map(s => ({
        id: s.id,
        generation: s.generation,
        fitnessScore: s.fitnessScore,
        fitnessComponents: s.fitnessComponents,
        genes: s.genes,
        humanReadable: humanReadableGenes(s.genes),
        trialCount: s.trialCount,
        parentIds: s.parentIds,
      })),
      bestEver: evo.bestStrategyEver
        ? {
            ...evo.bestStrategyEver,
            humanReadable: humanReadableGenes(evo.bestStrategyEver.genes || {}),
          }
        : null,
    });
  }

  // ── action: record-outcome ────────────────────────────────────────────────
  if (action === 'record-outcome') {
    const { strategyId, outcome } = body;
    if (!strategyId || !outcome) return jsonResponse({ error: 'strategyId and outcome required' }, 400);

    const { data: evo, sha: evoSha } = await loadJSON('data/evolution.json', token, DEFAULT_EVOLUTION);
    const pop = evo.population || [];
    const strategy = pop.find(s => s.id === strategyId);
    if (!strategy) return jsonResponse({ error: 'Strategy not found: ' + strategyId }, 404);

    // Append real-world outcome to trial results
    const outcomeEntry = {
      trialedAt: new Date().toISOString(),
      type: 'real-world',
      outcome,
      fitnessScore: strategy.fitnessScore,
    };
    strategy.trialResults = strategy.trialResults || [];
    strategy.trialResults.unshift(outcomeEntry);
    if (strategy.trialResults.length > 5) strategy.trialResults = strategy.trialResults.slice(0, 5);

    // Adjust fitness score based on outcome valence
    const isPositive = (outcome.revenueImpact > 0) || (outcome.leadImpact > 0) || (outcome.quoteImpact > 0);
    const isNegative = (outcome.revenueImpact < 0) || (outcome.leadImpact < 0) || (outcome.quoteImpact < 0);
    if (isPositive && !isNegative) {
      strategy.fitnessScore = Math.min(1, (strategy.fitnessScore || 0) + 0.05);
    } else if (isNegative && !isPositive) {
      strategy.fitnessScore = Math.max(0, (strategy.fitnessScore || 0) - 0.05);
    }
    strategy.fitnessScore = Math.round(strategy.fitnessScore * 1000) / 1000;

    await ghPut('data/evolution.json', JSON.stringify(evo, null, 2), evoSha, `Evolution: record outcome for ${strategyId}`, token);

    return jsonResponse({ recorded: true, strategyId, updatedFitness: strategy.fitnessScore });
  }

  return jsonResponse({ error: 'Unknown action. Use: initialise | evolve | get-recommendation | record-outcome' }, 400);
}
