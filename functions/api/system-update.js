const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Admin' },
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
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT failed: ' + r.status); }
  return r.json();
}

async function loadJSON(path, token, fallback = null) {
  try {
    const f = await ghGet(path, token);
    return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha };
  } catch (_) {
    return { data: fallback, sha: null };
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function callClaude(apiKey, system, user, maxTokens = 4096) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const d = await r.json();
  const text = (d.content || [])[0]?.text || '';
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(clean);
}

// ── Phase 1: Synthesise month's data into a master prompt ─────────────────

async function synthesisPhase(apiKey, context) {
  const system = `You are the strategic intelligence core of Tensor Works, an Australian AI hardware reseller.
Your task is to analyse one month of accumulated business data and synthesise it into a comprehensive master operational directive.
This directive will govern how all AI agents in the system behave for the coming month.
Be specific, data-driven, and actionable. Return ONLY valid JSON.`;

  const user = `Analyse the following month of accumulated data and produce a master operational directive.

BRAIN STATE (accumulated skills and patterns):
${JSON.stringify(context.brain?.skills || {}, null, 2)}

TREND HISTORY (last 30 daily snapshots):
${JSON.stringify((context.trends?.daily || []).slice(-30), null, 2)}

SIMULATION RESULTS (last 10):
${JSON.stringify((context.simulations || []).slice(-10), null, 2)}

INTELLIGENCE RUNS (last month):
${JSON.stringify((context.brain?.history?.intelligenceRuns || []).slice(-30), null, 2)}

ANOMALIES DETECTED:
${JSON.stringify((context.brain?.history?.anomaliesDetected || []).slice(-20), null, 2)}

DECISION LOG:
${JSON.stringify((context.brain?.decisionLog || []).slice(-50), null, 2)}

TOP CAMPAIGNS:
${JSON.stringify((context.campaigns || []).slice(-10), null, 2)}

CURRENT BUNDLES:
${JSON.stringify(context.bundles || [], null, 2)}

COMPETITOR INTELLIGENCE:
${JSON.stringify(context.competitorPrices || {}, null, 2)}

Synthesise all of this into a master operational directive with this exact JSON structure:
{
  "executiveSummary": "2-3 sentence summary of the month and strategic direction",
  "pricingDirective": {
    "philosophy": "string — overarching pricing approach for next month",
    "categoryAdjustments": {"category": "increase/hold/decrease and rationale"},
    "competitivePosture": "string — how to position vs competitors"
  },
  "productDirective": {
    "prioritise": ["handle — reason"],
    "deprioritise": ["handle — reason"],
    "bundleFocus": "string — which bundle types showed most promise"
  },
  "salesDirective": {
    "targetSegments": ["segment — approach"],
    "campaignThemes": ["theme"],
    "urgencyTriggers": ["trigger"]
  },
  "operationalRules": [
    "Specific rule the agents must follow, written as an instruction"
  ],
  "learnedPatterns": [
    "Specific pattern observed in the data with supporting evidence"
  ],
  "thingsToAvoid": [
    "Specific behaviour or action shown to be counterproductive"
  ],
  "constraintRecommendations": {
    "maxPriceChangePercent": null,
    "minConfidenceToAutoApply": null,
    "minMarginAUD": null
  },
  "strategicFocus": "One clear strategic priority for the coming month",
  "confidenceScore": 0.0,
  "dataQualityNotes": "string — assessment of data quality and any caveats"
}`;

  return callClaude(apiKey, system, user, 4096);
}

// ── Phase 2: Validation — cross-check the master prompt against stored data ─

async function validationPhase(apiKey, masterPrompt, context) {
  const system = `You are a critical safety validator for an AI-driven business system.
Your job is to rigorously cross-check a proposed master operational directive against historical data and existing system state.
Find contradictions, logical errors, unsupported conclusions, and dangerous deviations.
Be sceptical. Return ONLY valid JSON.`;

  const user = `Cross-check this proposed master operational directive against the system's stored data and history.

PROPOSED MASTER DIRECTIVE:
${JSON.stringify(masterPrompt, null, 2)}

EXISTING BRAIN CONSTRAINTS (must not be violated):
${JSON.stringify(context.brain?.constraints || {}, null, 2)}

HISTORICAL DECISION OUTCOMES:
${JSON.stringify((context.brain?.history?.priceChanges || []).slice(-20), null, 2)}

EXISTING LEARNED SKILLS:
${JSON.stringify(context.brain?.skills || {}, null, 2)}

Check for:
1. Internal contradictions (does the directive contradict itself?)
2. Historical contradictions (does it contradict proven successful patterns?)
3. Constraint violations (does it violate existing safety constraints?)
4. Unsupported conclusions (are major claims backed by the data?)
5. Logical errors (are the cause-effect relationships sound?)
6. Dangerous deviations (does it propose changes >20% different from current norms?)
7. Missing safety considerations

Return:
{
  "validationPassed": boolean,
  "overallScore": 0.0,
  "issues": [
    {
      "severity": "critical|warning|info",
      "field": "which part of the directive",
      "issue": "description of the problem",
      "suggestion": "how to fix it"
    }
  ],
  "corrections": {
    "fieldPath": "corrected value"
  },
  "validatorNotes": "string — overall assessment",
  "approvedForImplementation": boolean,
  "requiresHumanReview": boolean
}`;

  return callClaude(apiKey, system, user, 2048);
}

// ── Phase 3: Bug check — scan for implementation errors ──────────────────

async function bugCheckPhase(apiKey, masterPrompt, validation) {
  const system = `You are a software quality assurance agent reviewing a structured data update before it is written to a production system.
Check for data type errors, missing required fields, invalid values, and structural problems.
Return ONLY valid JSON.`;

  const user = `Review this master directive and its validation result for any implementation bugs before it is written to the brain.

MASTER DIRECTIVE:
${JSON.stringify(masterPrompt, null, 2)}

VALIDATION CORRECTIONS REQUESTED:
${JSON.stringify(validation.corrections || {}, null, 2)}

Check:
1. All required fields are present and non-null
2. Numeric values are within sensible ranges (e.g. confidenceScore 0-1, margins > 0)
3. Arrays are properly formed
4. No circular references or undefined values
5. constraintRecommendations values are safe (e.g. maxPriceChangePercent should be 5-25)
6. Apply the validation corrections to produce the final clean directive

Return:
{
  "bugsFound": ["description of each bug"],
  "cleanedDirective": { ... the corrected master directive ready for implementation ... },
  "implementationSafe": boolean,
  "bugCheckNotes": "string"
}`;

  return callClaude(apiKey, system, user, 4096);
}

// ── Main handler ──────────────────────────────────────────────────────────

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

  const token = env.GITHUB_PAT;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const mp = await loadJSON('data/master-prompt.json', token, { version: 0, current: null, history: [] });
    return jsonResponse(mp.data);
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  // Protect cron-triggered runs; allow unauthenticated from admin
  const syncSecret = env.SYNC_SECRET;
  const providedSecret = request.headers.get('X-Sync-Secret');
  const body = await request.json().catch(() => ({}));
  const isAdmin = body.fromAdmin === true;
  if (syncSecret && !isAdmin && providedSecret !== syncSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const startedAt = new Date().toISOString();
  const log = [];

  try {
    // Load all data sources in parallel
    log.push({ step: 'load', status: 'loading' });
    const [brainRes, trendsRes, simsRes, decisionsRes, campaignsRes, bundlesRes, compPricesRes, masterRes] = await Promise.all([
      loadJSON('data/brain.json', token, {}),
      loadJSON('data/trends.json', token, { daily: [], weekly: [] }),
      loadJSON('data/simulations.json', token, []),
      loadJSON('data/decisions.json', token, []),
      loadJSON('data/campaigns.json', token, []),
      loadJSON('data/bundles.json', token, []),
      loadJSON('data/competitor-prices.json', token, {}),
      loadJSON('data/master-prompt.json', token, { version: 0, current: null, history: [] }),
    ]);

    const dataContext = {
      brain: brainRes.data,
      trends: trendsRes.data,
      simulations: simsRes.data,
      decisions: decisionsRes.data,
      campaigns: campaignsRes.data,
      bundles: bundlesRes.data,
      competitorPrices: compPricesRes.data,
    };
    log.push({ step: 'load', status: 'ok', sources: 8 });

    // Phase 1: Synthesis
    log.push({ step: 'synthesis', status: 'running' });
    let masterPrompt;
    try {
      masterPrompt = await synthesisPhase(apiKey, dataContext);
      log.push({ step: 'synthesis', status: 'ok', confidenceScore: masterPrompt.confidenceScore });
    } catch (e) {
      return jsonResponse({ error: 'Synthesis phase failed: ' + e.message, log }, 500);
    }

    // Phase 2: Validation
    log.push({ step: 'validation', status: 'running' });
    let validation;
    try {
      validation = await validationPhase(apiKey, masterPrompt, dataContext);
      log.push({ step: 'validation', status: 'ok', passed: validation.validationPassed, issues: (validation.issues || []).length });
    } catch (e) {
      return jsonResponse({ error: 'Validation phase failed: ' + e.message, log }, 500);
    }

    if (!validation.approvedForImplementation) {
      // Save the failed attempt and return for human review
      const record = {
        generatedAt: startedAt,
        status: 'requires-review',
        masterPrompt,
        validation,
        log,
      };
      const mp = masterRes.data;
      mp.pendingReview = record;
      await ghPut('data/master-prompt.json', JSON.stringify(mp, null, 2), masterRes.sha, 'System update requires human review', token);
      return jsonResponse({ requiresHumanReview: true, validation, masterPrompt, log });
    }

    // Phase 3: Bug check
    log.push({ step: 'bug-check', status: 'running' });
    let bugCheck;
    try {
      bugCheck = await bugCheckPhase(apiKey, masterPrompt, validation);
      log.push({ step: 'bug-check', status: 'ok', bugs: (bugCheck.bugsFound || []).length, safe: bugCheck.implementationSafe });
    } catch (e) {
      return jsonResponse({ error: 'Bug check phase failed: ' + e.message, log }, 500);
    }

    if (!bugCheck.implementationSafe) {
      return jsonResponse({ error: 'Bug check blocked implementation', bugs: bugCheck.bugsFound, log }, 409);
    }

    const finalDirective = bugCheck.cleanedDirective || masterPrompt;

    // Phase 4: Implement — merge into brain.json
    log.push({ step: 'implementation', status: 'running' });
    const brain = brainRes.data || {};

    // Apply constraint recommendations if present
    const cr = finalDirective.constraintRecommendations || {};
    if (cr.maxPriceChangePercent) brain.constraints = brain.constraints || {};
    if (cr.maxPriceChangePercent) brain.constraints.maxPriceChangePercent = cr.maxPriceChangePercent;
    if (cr.minConfidenceToAutoApply) brain.constraints.minConfidenceToAutoApply = cr.minConfidenceToAutoApply;
    if (cr.minMarginAUD) brain.constraints.minMarginAUD = cr.minMarginAUD;

    // Inject master directive into brain.skills.masterDirective
    brain.skills = brain.skills || {};
    brain.skills.masterDirective = {
      strategicFocus: finalDirective.strategicFocus,
      operationalRules: finalDirective.operationalRules,
      learnedPatterns: finalDirective.learnedPatterns,
      thingsToAvoid: finalDirective.thingsToAvoid,
      pricingDirective: finalDirective.pricingDirective,
      productDirective: finalDirective.productDirective,
      salesDirective: finalDirective.salesDirective,
      implementedAt: new Date().toISOString(),
    };

    brain.meta = brain.meta || {};
    brain.meta.lastSystemUpdate = new Date().toISOString();
    brain.meta.lastUpdated = new Date().toISOString();

    // Append a note
    brain.meta.notes = brain.meta.notes || [];
    brain.meta.notes.unshift('Monthly system update applied ' + new Date().toLocaleDateString('en-AU') + ': ' + (finalDirective.strategicFocus || ''));
    if (brain.meta.notes.length > 50) brain.meta.notes = brain.meta.notes.slice(0, 50);

    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainRes.sha, 'Monthly system update: inject master directive into brain', token);
    log.push({ step: 'implementation', status: 'ok' });

    // Save master-prompt.json with full audit trail
    const mp = masterRes.data || { version: 0, current: null, history: [] };
    const record = {
      version: (mp.version || 0) + 1,
      generatedAt: startedAt,
      implementedAt: new Date().toISOString(),
      status: 'implemented',
      executiveSummary: finalDirective.executiveSummary,
      strategicFocus: finalDirective.strategicFocus,
      confidenceScore: finalDirective.confidenceScore,
      validationScore: validation.overallScore,
      bugsFound: bugCheck.bugsFound || [],
      directive: finalDirective,
      validationResult: validation,
      bugCheckResult: { implementationSafe: bugCheck.implementationSafe, notes: bugCheck.bugCheckNotes },
      log,
    };
    if (mp.current) {
      mp.history = mp.history || [];
      mp.history.unshift(mp.current);
      if (mp.history.length > 12) mp.history = mp.history.slice(0, 12); // keep 12 months
    }
    mp.current = record;
    mp.version = record.version;
    mp.pendingReview = null;

    await ghPut('data/master-prompt.json', JSON.stringify(mp, null, 2), masterRes.sha, 'Monthly system update v' + record.version + ' implemented', token);

    return jsonResponse({
      success: true,
      version: record.version,
      executiveSummary: finalDirective.executiveSummary,
      strategicFocus: finalDirective.strategicFocus,
      confidenceScore: finalDirective.confidenceScore,
      validationScore: validation.overallScore,
      issuesFound: (validation.issues || []).length,
      bugsFound: (bugCheck.bugsFound || []).length,
      constraintsUpdated: Object.keys(cr).filter(k => cr[k] !== null).length,
      log,
    });

  } catch (e) {
    return jsonResponse({ error: e.message, log }, 500);
  }
}
