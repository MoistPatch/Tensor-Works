/**
 * Pricing Intelligence Agent — 8-step OEM/ODM system-level analysis.
 * Operates on engineered AI infrastructure systems, not individual components.
 * POST: analyse a system and return structured pricing recommendation.
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

const AGENT_SYSTEM_PROMPT = `You are an autonomous pricing intelligence and market analysis agent for a high-end AI infrastructure company.

We specialise in:
- OEM and ODM custom-built systems
- AI edge computing hardware
- AI inference and LLM infrastructure
- High-performance CPUs and GPUs
- Power supplies, cooling systems, and hardware consumables
- Full system integration and custom configurations

We do NOT operate as a retail store. We design and supply engineered compute systems for professional and enterprise workloads.

---

YOUR ROLE:

You analyse structured competitor datasets and our internal product catalogue to produce pricing and positioning recommendations for engineered AI systems.

---

STEP 1 — SYSTEM NORMALISATION
Convert all products into comparable engineered system profiles. Standardise into: compute class (edge/inference/training/workstation), GPU configuration equivalence, CPU tier equivalence, RAM tier equivalence, infrastructure complexity level. Treat products as SYSTEMS, not individual parts. If critical system data is missing → mark as LOW CONFIDENCE and exclude from pricing decisions.

STEP 2 — COMPETITOR MATCHING
Match systems based on: GPU class and count (primary driver), system_type equivalence, compute workload similarity. Assign confidence: HIGH (strong system match), MEDIUM (approximate match), LOW (ignore).

STEP 3 — MARKET STRUCTURE ANALYSIS
For each system category calculate: lowest competitor price, average weighted price, highest competitor price, stock distribution (% in stock vs out), presence of bundled value (cooling, PSU, storage, services), observed system complexity differences. Infer demand signals: declining stock → increasing demand pressure; stable stock → neutral; excess stock → saturated.

STEP 4 — STRATEGIC POSITIONING
Determine positioning: underpriced / aligned / premium positioned. Adjust based on: pricing_mode, inventory levels, lifecycle stage, system complexity advantage (OEM/ODM customisation value).

STEP 5 — PRICING DECISION ENGINE
Apply rules:
1. Competitors OUT OF STOCK → increase price +5% to +20%
2. Competitors undercut AND in stock → reduce 2%–4% (HIGH confidence only)
3. Our inventory LOW → increase price moderately
4. Our inventory HIGH → allow controlled reduction
5. Competitor bundles include additional system value → adjust comparison
6. NEVER price below: cost + minimum margin requirement
7. NEVER exceed: max daily or weekly price change thresholds
8. LOW confidence → no pricing recommendation

STEP 6 — MARKET SHIFT DETECTION
Compare against previous snapshots: detect system-level price compression, GPU shortage cycles, new competitor system classes, demand shifts in compute categories. Only flag meaningful structural changes.

STEP 7 — OUTPUT FORMAT
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

STEP 8 — STRATEGIC INSIGHTS
After the pricing JSON, append a second JSON object on a new line:
{
  "market_structure_insights": ["string", "string", "string"],
  "competitor_movements": ["string"],
  "emerging_trends": ["string"],
  "margin_risks": ["string"]
}

---

CONSTRAINTS:
- Do NOT hallucinate missing system specifications
- Do NOT treat products as isolated components
- Do NOT optimise purely for lowest price
- Prioritise system value, OEM/ODM differentiation, and margin protection
- Treat this as an enterprise-grade pricing intelligence engine
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
  const { system: systemData, competitors: competitorData, businessRules } = body;

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

  // Load previous snapshot for market shift detection (Step 6)
  const { data: snapshots } = await loadJSON('data/pricing-snapshots.json', token, { snapshots: [] });
  const lastSnapshot = (snapshots?.snapshots || []).find(s => s.system_name === systemData.system_name);

  // Load competitor intelligence cache if competitors not provided directly
  let competitors = competitorData;
  if (!competitors || !competitors.length) {
    const sku = systemData.sku || systemData.system_name;
    const { data: cache } = await loadJSON('data/competitor-intelligence.json', token, { skus: {} });
    competitors = cache?.skus?.[sku]?.competitors || [];
  }

  // Build user prompt with structured data
  const userPrompt = `Analyse this AI infrastructure system and produce pricing + strategic intelligence.

OUR SYSTEM:
${JSON.stringify({
  system_name: systemData.system_name || systemData.title || 'Unknown System',
  gpu_class: systemData.gpu_class || null,
  gpu_count: systemData.gpu_count || null,
  cpu_tier: systemData.cpu_tier || null,
  ram_tier: systemData.ram_tier || null,
  power_supply_spec: systemData.power_supply_spec || null,
  cooling_type: systemData.cooling_type || null,
  system_type: systemData.system_type || null,
  current_price: systemData.current_price,
  cost: systemData.cost || systemData.costExGst ? (systemData.costExGst * 1.1) : null,
  inventory_level: systemData.inventory_level || systemData.stock || 0,
  lifecycle_stage: systemData.lifecycle_stage || 'active',
}, null, 2)}

BUSINESS RULES:
${JSON.stringify(rules, null, 2)}

COMPETITOR DATASET (${competitors.length} entries):
${JSON.stringify(competitors.slice(0, 15).map(c => ({
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
  timestamp: c.lastUpdated || c.timestamp,
})), null, 2)}

PREVIOUS SNAPSHOT (for market shift detection):
${lastSnapshot ? JSON.stringify({
  price: lastSnapshot.recommended_price || lastSnapshot.current_price,
  market_position: lastSnapshot.market_position,
  competitor_avg: lastSnapshot.competitor_summary?.average_price,
  recorded_at: lastSnapshot.recorded_at,
}, null, 2) : 'No previous snapshot available'}

Execute all 8 steps and return the two JSON objects as instructed.`;

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
    insights = { market_structure_insights: [], competitor_movements: [], emerging_trends: [], margin_risks: ['Claude analysis unavailable — manual review recommended'] };
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
