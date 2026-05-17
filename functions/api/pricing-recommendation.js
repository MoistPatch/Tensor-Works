/**
 * Pricing Intelligence Agent — 9-step OEM/ODM system-level analysis.
 * Operates on engineered AI infrastructure systems, not individual components.
 * POST: analyse a system and return structured pricing recommendation.
 *
 * Input accepts optional marketSignals: { reddit, googleTrends }
 * Competitor data validated for freshness before analysis (Step 1).
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

async function callClaude(apiKey, system, messages, maxTokens = 4096, enableThinking = true) {
  const reqBody = { model: 'claude-opus-4-7', max_tokens: maxTokens, system, messages };
  if (enableThinking) {
    reqBody.thinking = { type: 'enabled', budget_tokens: Math.floor(maxTokens * 0.4) };
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

// ── Pricing Intelligence Agent System Prompt ─────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are an autonomous market intelligence and pricing optimisation agent for a high-end AI infrastructure company.

We specialise in:
- OEM and ODM custom-built systems
- AI edge computing hardware
- AI inference and LLM infrastructure systems
- High-performance GPUs, CPUs, power supplies, and cooling systems
- Full system integration and engineered compute solutions

We are NOT a retail store. We design, build, and supply engineered compute systems.

---

SYSTEM ARCHITECTURE CONTEXT:

This system consists of multiple layers:
1. Apify → primary data collection engine (competitor scraping, pricing, stock levels)
2. GitHub → historical market and product memory (snapshots)
3. n8n → orchestration layer (data movement and scheduling)
4. Claude (YOU) → intelligence and decision engine
5. Reddit + Google Trends → demand and sentiment signals
6. Shopify API → execution layer (pricing and product updates)
7. Admin dashboard → human oversight

You are ONLY responsible for analysis and pricing decisions.
You do NOT crawl websites.
You do NOT fetch data directly.
You analyse structured datasets provided to you.

---

STEP 1 — DATA VALIDATION (APIFY DATA CONTROL)

All competitor data originates from Apify crawls.
- Validate freshness using timestamps. Flag entries older than 24 hours.
- Reject stale or incomplete data.
- Ignore entries missing: price, gpu_class, stock_status (unless corroborated elsewhere).

Assign confidence:
- HIGH (complete + recent + consistent)
- MEDIUM (minor missing fields, or timestamp 12–24h old)
- LOW (ignore — missing critical fields or timestamp >24h)

---

STEP 2 — SYSTEM NORMALISATION

Convert all products into comparable compute systems. Standardise into:
- compute_class (edge / inference / training / workstation)
- gpu_equivalence_class
- cpu_tier
- ram_tier
- system_complexity_level

Treat all inputs as ENGINEERED SYSTEMS, not retail products.
If critical system data is missing → mark as LOW CONFIDENCE and exclude from pricing decisions.

---

STEP 3 — COMPETITOR MATCHING

Match our systems with competitor systems using:
- GPU class (primary driver)
- GPU count
- system_type equivalence
- workload similarity

Assign:
- HIGH confidence match
- MEDIUM confidence match
- LOW confidence (ignore)

---

STEP 4 — MARKET STRUCTURE ANALYSIS

For each system category calculate:
- lowest competitor price (weighted by confidence)
- average competitor price
- highest competitor price
- stock distribution (% in stock vs out of stock)
- bundle/value additions (cooling, PSU, storage, tuning services)

Infer demand signals:
- declining stock → high demand pressure
- stable stock → neutral demand
- excess stock → saturated market

---

STEP 5 — STRATEGIC POSITIONING

Determine positioning of each system:
- underpriced
- aligned
- premium positioned

Adjust based on:
- pricing_mode (premium / competitive / aggressive)
- inventory level
- lifecycle stage (new / active / scaling / clearance)
- system complexity advantage (OEM/ODM custom engineering value)
- demand pressure signals from market signals

---

STEP 6 — PRICING DECISION ENGINE

Apply rules:

1. If competitors are predominantly OUT OF STOCK:
   → increase price +5% to +20%

2. If competitors undercut AND are IN STOCK:
   → reduce price 2%–4% (HIGH confidence only)

3. If OUR inventory is LOW:
   → increase price moderately

4. If OUR inventory is HIGH:
   → allow controlled reduction to stimulate demand

5. If competitor bundles include additional system value:
   → adjust comparison using estimated system-level value equivalence

6. NEVER reduce below:
   cost + minimum margin requirement

7. NEVER exceed:
   max daily or weekly price change limits

8. If confidence is LOW:
   → do not recommend any price change

---

STEP 7 — MARKET SHIFT DETECTION (INCLUDING HISTORICAL SNAPSHOTS)

Using historical snapshots:
- detect price compression trends
- detect GPU supply shortages
- detect emerging competitor system classes
- detect demand acceleration or decline

Only report meaningful structural changes.

---

STEP 8 — OUTPUT FORMAT (STRICT JSON ONLY)

Return a JSON object with exactly these fields (no markdown, no preamble):
{
  "system_name": "string",
  "current_price": number,
  "recommended_price": number,
  "price_change_percent": number,
  "market_position": "underpriced|aligned|premium",
  "pricing_mode": "string",
  "reason": "string",
  "key_factors": ["string"],
  "competitor_summary": {
    "lowest_price": number,
    "average_price": number,
    "highest_price": number,
    "stock_pressure": "low|medium|high"
  },
  "confidence": "low|medium|high",
  "warnings": ["string"]
}

STEP 9 — STRATEGIC INSIGHTS

After the pricing JSON, append a second JSON object on a new line:
{
  "market_structure_insights": ["string", "string", "string"],
  "competitor_movements": ["string"],
  "emerging_demand_signals": ["string"],
  "margin_risks": ["string"]
}

The emerging_demand_signals field must incorporate Reddit sentiment and Google Trends data if provided.

---

CONSTRAINTS:
- Do NOT hallucinate missing data
- Do NOT treat retail products as isolated components
- Do NOT optimise purely for lowest price
- Do NOT override business rules
- Prioritise OEM/ODM system value, margin protection, and market positioning
- Treat Apify data as the PRIMARY source of market truth
- Return ONLY two JSON objects separated by a newline — no other text`;

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
  const { system: systemData, competitors: competitorData, businessRules, marketSignals } = body;

  if (!systemData) return jsonResponse({ error: 'system data is required' }, 400);
  if (!systemData.current_price) return jsonResponse({ error: 'system.current_price is required' }, 400);

  // Load business rules (request body overrides stored rules)
  const { data: storedRules } = await loadJSON('data/pricing-rules.json', token, {
    pricing_mode: 'premium',
    minimum_margin_percent: 20,
    max_daily_price_change_percent: 10,
    max_weekly_price_change_percent: 25,
  });

  const rules = { ...storedRules, ...(businessRules || {}) };

  // Load previous snapshot for market shift detection (Step 7)
  const { data: snapshots } = await loadJSON('data/pricing-snapshots.json', token, { snapshots: [] });
  const lastSnapshot = (snapshots?.snapshots || []).find(s => s.system_name === systemData.system_name);

  // Load competitor intelligence cache if competitors not provided directly
  let competitors = competitorData;
  if (!competitors || !competitors.length) {
    const sku = systemData.sku || systemData.system_name;
    const { data: cache } = await loadJSON('data/competitor-intelligence.json', token, { skus: {} });
    competitors = cache?.skus?.[sku]?.competitors || [];
  }

  // Step 1 pre-filter: tag competitor entries with data quality before sending to Claude
  const now = Date.now();
  const taggedCompetitors = competitors.slice(0, 15).map(c => {
    const ts = c.lastUpdated || c.timestamp;
    const ageMs = ts ? now - new Date(ts).getTime() : Infinity;
    const ageHours = ageMs / 3600000;
    const hasPrice = !!c.price;
    const hasGpuClass = !!(c.gpu_class || c.gpuClass);
    const hasStock = !!(c.stockStatus || c.stock_status);
    let dataQuality;
    if (!hasPrice || !hasGpuClass || ageHours > 24) dataQuality = 'LOW';
    else if (!hasStock || ageHours > 12) dataQuality = 'MEDIUM';
    else dataQuality = 'HIGH';
    return {
      competitor_name: c.competitor || c.competitor_name,
      product_name: c.productName || c.product_name,
      price: c.price,
      currency: c.currency || 'AUD',
      gpu_class: c.gpu_class || null,
      gpu_count: c.gpu_count || null,
      cpu: c.cpu || null,
      ram: c.ram || null,
      cooling: c.cooling || null,
      power_specs: c.power_specs || null,
      stock_status: c.stockStatus || c.stock_status || 'unknown',
      bundle_inclusions: c.bundleDeals?.length ? c.bundleDeals : (c.bundle_inclusions || null),
      url: c.url,
      timestamp: ts || null,
      data_age_hours: Math.round(ageHours * 10) / 10,
      data_quality: dataQuality,
    };
  });

  // Market signals section (Reddit + Google Trends)
  const signals = marketSignals || {};
  const signalsSection = (signals.reddit || signals.googleTrends || signals.keywords)
    ? `MARKET SIGNAL DATA:
${JSON.stringify({
  reddit_sentiment: signals.reddit || null,
  google_trends: signals.googleTrends || null,
  detected_keywords: signals.keywords || null,
  demand_spikes: signals.demandSpikes || null,
}, null, 2)}`
    : 'MARKET SIGNAL DATA: Not provided for this analysis run.';

  // Build user prompt with structured data
  const userPrompt = `Analyse this AI infrastructure system and produce pricing + strategic intelligence.

OUR SYSTEM:
${JSON.stringify({
  system_name: systemData.system_name || systemData.title || 'Unknown System',
  gpu_class: systemData.gpu_class || null,
  gpu_count: systemData.gpu_count || null,
  cpu_tier: systemData.cpu_tier || null,
  ram_tier: systemData.ram_tier || null,
  storage: systemData.storage || null,
  power_supply_spec: systemData.power_supply_spec || null,
  cooling_type: systemData.cooling_type || null,
  system_type: systemData.system_type || null,
  current_price: systemData.current_price,
  cost: systemData.cost || (systemData.costExGst ? systemData.costExGst * 1.1 : null),
  inventory_level: systemData.inventory_level || systemData.stock || 0,
  lifecycle_stage: systemData.lifecycle_stage || 'active',
}, null, 2)}

BUSINESS RULES:
${JSON.stringify({
  pricing_mode: rules.pricing_mode || 'premium',
  minimum_margin_percent: rules.minimum_margin_percent || 20,
  max_daily_price_change_percent: rules.max_daily_price_change_percent || 10,
  max_weekly_price_change_percent: rules.max_weekly_price_change_percent || 25,
}, null, 2)}

COMPETITOR DATASET — ${taggedCompetitors.length} entries (Apify-sourced, pre-tagged with data_quality):
${JSON.stringify(taggedCompetitors, null, 2)}

${signalsSection}

HISTORICAL SNAPSHOT (for Step 7 market shift detection):
${lastSnapshot ? JSON.stringify({
  price: lastSnapshot.recommended_price || lastSnapshot.current_price,
  market_position: lastSnapshot.market_position,
  competitor_avg: lastSnapshot.competitor_summary?.average_price,
  recorded_at: lastSnapshot.recorded_at,
}, null, 2) : 'No previous snapshot available — first analysis for this system.'}

Execute all 9 steps and return the two JSON objects as instructed.`;

  let pricing, insights, thinking;

  try {
    const { text, thinking: t } = await callClaude(apiKey, AGENT_SYSTEM_PROMPT, [{ role: 'user', content: userPrompt }], 4096, true);
    thinking = t;

    // Parse two JSON objects from response
    const trimmed = text.trim();
    const jsonBlocks = [];
    let depth = 0, start = -1;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '{') { if (depth === 0) start = i; depth++; }
      else if (trimmed[i] === '}') { depth--; if (depth === 0 && start !== -1) { jsonBlocks.push(trimmed.slice(start, i + 1)); start = -1; } }
    }

    if (jsonBlocks.length >= 1) pricing = JSON.parse(jsonBlocks[0]);
    if (jsonBlocks.length >= 2) insights = JSON.parse(jsonBlocks[1]);
  } catch (e) {
    // Deterministic fallback
    const compPrices = competitors.filter(c => c.price).map(c => c.price);
    const avgComp = compPrices.length ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : null;
    const minComp = compPrices.length ? Math.min(...compPrices) : null;
    const maxComp = compPrices.length ? Math.max(...compPrices) : null;
    const cp = systemData.current_price;
    const cost = systemData.cost || (systemData.costExGst ? systemData.costExGst * 1.1 : cp * 0.75);
    const minPrice = cost * (1 + rules.minimum_margin_percent / 100);

    let recPrice = cp;
    let position = 'aligned';
    if (minComp && cp > minComp * 1.05) { position = 'premium'; }
    else if (minComp && cp < minComp * 0.95) { position = 'underpriced'; recPrice = Math.max(minPrice, cp * 1.05); }

    pricing = {
      system_name: systemData.system_name || systemData.title,
      current_price: cp,
      recommended_price: Math.round(recPrice),
      price_change_percent: Math.round((recPrice - cp) / cp * 1000) / 10,
      market_position: position,
      pricing_mode: rules.pricing_mode,
      reason: `Claude analysis unavailable (${e.message}). Deterministic fallback applied.`,
      key_factors: compPrices.length ? [`${compPrices.length} competitor prices found`, `Avg competitor: A$${Math.round(avgComp).toLocaleString('en-AU')}`] : ['No competitor price data available'],
      competitor_summary: { lowest_price: minComp, average_price: avgComp ? Math.round(avgComp) : null, highest_price: maxComp, stock_pressure: 'unknown' },
      confidence: compPrices.length >= 2 ? 'medium' : 'low',
      warnings: ['Using deterministic fallback — Claude analysis failed'],
    };
    insights = { market_structure_insights: [], competitor_movements: [], emerging_demand_signals: [], margin_risks: ['Claude analysis unavailable — manual review recommended'] };
  }

  // Save snapshot for future market shift detection
  if (pricing && pricing.confidence !== 'low') {
    try {
      const snapshotStore = snapshots?.snapshots || [];
      const idx = snapshotStore.findIndex(s => s.system_name === pricing.system_name);
      const entry = { ...pricing, insights, recorded_at: new Date().toISOString() };
      if (idx >= 0) snapshotStore[idx] = entry; else snapshotStore.push(entry);
      if (snapshotStore.length > 100) snapshotStore.splice(0, snapshotStore.length - 100);
      const { sha: snapSha } = await loadJSON('data/pricing-snapshots.json', token, null);
      await ghPut('data/pricing-snapshots.json', JSON.stringify({ snapshots: snapshotStore }, null, 2), snapSha,
        `Pricing snapshot: ${pricing.system_name} ${new Date().toISOString()}`, token);
    } catch (_) {}
  }

  return jsonResponse({
    ...pricing,
    insights: insights || null,
    thinking: thinking || null,
  });
}
