/**
 * Data Validator — comprehensive data quality pipeline.
 * Runs before every analysis cycle. Validates schemas, value ranges,
 * cross-source consistency, staleness, and statistical outliers.
 * Quarantines suspect data rather than letting it corrupt analysis.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
const MAX_DATA_AGE_DAYS = 7;     // data older than this is flagged stale
const OUTLIER_ZSCORE = 3.0;      // z-score threshold for numeric outliers
const MIN_QUALITY_TO_PROCEED = 0.5; // below this, pause auto-apply

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

// ── Statistical helpers ────────────────────────────────────────────────────

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function zScore(val, arr) {
  const sd = stddev(arr);
  return sd === 0 ? 0 : Math.abs(val - mean(arr)) / sd;
}
function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / 86400000;
}

// ── Per-source validators ──────────────────────────────────────────────────

function validateProducts(products) {
  const issues = [], warnings = [];
  const REQUIRED = ['handle', 'title', 'category', 'sku'];
  const VALID_CATEGORIES = ['GPU Accelerators','DGX Systems','Workstation GPU','Data Processing Unit','Software Suite','Server Platform','Networking'];
  const handles = new Set();

  if (!Array.isArray(products)) return { issues: ['products.json is not an array'], warnings: [], score: 0, cleanCount: 0 };

  products.forEach((p, i) => {
    const ref = `product[${i}] (${p.handle || 'no-handle'})`;
    REQUIRED.forEach(f => { if (!p[f]) issues.push(`${ref}: missing required field "${f}"`); });
    if (p.handle && !/^[a-z0-9-]+$/.test(p.handle)) issues.push(`${ref}: handle contains invalid characters`);
    if (p.handle && handles.has(p.handle)) issues.push(`${ref}: duplicate handle "${p.handle}"`);
    if (p.handle) handles.add(p.handle);
    if (p.category && !VALID_CATEGORIES.includes(p.category)) warnings.push(`${ref}: unknown category "${p.category}"`);
    if (p.costExGst !== null && p.costExGst !== undefined) {
      if (typeof p.costExGst !== 'number' || p.costExGst <= 0) issues.push(`${ref}: costExGst must be a positive number`);
      if (p.costExGst > 10000000) warnings.push(`${ref}: costExGst ${p.costExGst} seems implausibly high`);
    }
    if (p.shopifyVariantId && !/^\d+$/.test(String(p.shopifyVariantId))) warnings.push(`${ref}: shopifyVariantId looks malformed`);
    if (!Array.isArray(p.specs)) warnings.push(`${ref}: specs should be an array`);
  });

  const cleanCount = products.filter(p => REQUIRED.every(f => p[f]) && /^[a-z0-9-]+$/.test(p.handle || '')).length;
  const score = products.length ? cleanCount / products.length : 1;
  return { issues, warnings, score, cleanCount, total: products.length };
}

function validateAnalytics(analytics) {
  const issues = [], warnings = [];
  if (!analytics || typeof analytics !== 'object') return { issues: ['analytics.json is missing or malformed'], warnings: [], score: 0 };

  const sessions = analytics.sessions || [];
  const now = new Date();
  let validSessions = 0;

  sessions.forEach((s, i) => {
    if (!s.date) { warnings.push(`session[${i}]: missing date`); return; }
    const d = new Date(s.date);
    if (isNaN(d.getTime())) { issues.push(`session[${i}]: invalid date "${s.date}"`); return; }
    if (d > now) { issues.push(`session[${i}]: future date "${s.date}" — likely clock skew or fabricated data`); return; }
    if (daysSince(s.date) > 365) { warnings.push(`session[${i}]: date is over a year old — may be stale`); }
    if (!Array.isArray(s.pages)) warnings.push(`session[${i}]: pages should be an array`);
    if (!Array.isArray(s.products)) warnings.push(`session[${i}]: products should be an array`);
    validSessions++;
  });

  // Check staleness — warn if no sessions in last 7 days
  const recentSessions = sessions.filter(s => daysSince(s.date) <= MAX_DATA_AGE_DAYS);
  if (sessions.length > 0 && recentSessions.length === 0) {
    warnings.push(`No sessions in the last ${MAX_DATA_AGE_DAYS} days — analytics may be stale`);
  }

  const score = sessions.length ? validSessions / sessions.length : 1;
  return { issues, warnings, score, validSessions, total: sessions.length };
}

function validateCompetitorPrices(prices, productHandles) {
  const issues = [], warnings = [];
  if (!prices || typeof prices !== 'object') return { issues: [], warnings: [], score: 1, note: 'No competitor data yet' };

  const allPrices = [];
  let totalEntries = 0, validEntries = 0;

  Object.entries(prices).forEach(([compId, entries]) => {
    if (!Array.isArray(entries)) { issues.push(`Competitor "${compId}": price data is not an array`); return; }
    entries.forEach((e, i) => {
      totalEntries++;
      const ref = `competitor[${compId}][${i}]`;
      if (!e.matchedHandle) { warnings.push(`${ref}: missing matchedHandle`); return; }
      if (!productHandles.has(e.matchedHandle)) { warnings.push(`${ref}: matchedHandle "${e.matchedHandle}" not found in products.json`); return; }
      if (e.competitorPrice !== undefined && e.competitorPrice !== null) {
        const p = parseFloat(e.competitorPrice);
        if (isNaN(p) || p <= 0) { issues.push(`${ref}: invalid price "${e.competitorPrice}"`); return; }
        if (p > 10000000) { warnings.push(`${ref}: price ${p} seems implausibly high`); }
        allPrices.push(p);
      }
      if (e.crawledAt && daysSince(e.crawledAt) > MAX_DATA_AGE_DAYS * 2) {
        warnings.push(`${ref}: price data is ${Math.round(daysSince(e.crawledAt))} days old`);
      }
      validEntries++;
    });
  });

  // Outlier detection on prices
  if (allPrices.length > 5) {
    allPrices.forEach((p, i) => {
      if (zScore(p, allPrices) > OUTLIER_ZSCORE) {
        warnings.push(`Competitor price outlier detected: A$${p.toLocaleString()} has z-score > ${OUTLIER_ZSCORE} — may be erroneous`);
      }
    });
  }

  const score = totalEntries ? validEntries / totalEntries : 1;
  return { issues, warnings, score, validEntries, total: totalEntries };
}

function validateTrends(trends) {
  const issues = [], warnings = [];
  if (!trends || typeof trends !== 'object') return { issues: ['trends.json missing or malformed'], warnings: [], score: 0 };

  const daily = trends.daily || [];
  const now = new Date();
  let validDays = 0;

  daily.forEach((d, i) => {
    if (!d.date) { warnings.push(`trends.daily[${i}]: missing date`); return; }
    const dt = new Date(d.date);
    if (isNaN(dt.getTime())) { issues.push(`trends.daily[${i}]: invalid date`); return; }
    if (dt > now) { issues.push(`trends.daily[${i}]: future date — data fabrication risk`); return; }
    // Check chronological order
    if (i > 0 && daily[i-1].date && d.date < daily[i-1].date) {
      warnings.push(`trends.daily[${i}]: dates not in chronological order`);
    }
    if (typeof d.sessions !== 'number' || d.sessions < 0) {
      warnings.push(`trends.daily[${i}]: sessions value "${d.sessions}" is not a non-negative number`);
    }
    validDays++;
  });

  // Session count outlier detection
  const sessionCounts = daily.filter(d => typeof d.sessions === 'number').map(d => d.sessions);
  if (sessionCounts.length > 7) {
    sessionCounts.forEach((s, i) => {
      if (zScore(s, sessionCounts) > OUTLIER_ZSCORE) {
        warnings.push(`trends.daily[${i}]: session count ${s} is a statistical outlier (z > ${OUTLIER_ZSCORE})`);
      }
    });
  }

  const score = daily.length ? validDays / daily.length : 1;
  return { issues, warnings, score, days: daily.length, validDays };
}

function validateBrain(brain) {
  const issues = [], warnings = [];
  if (!brain || typeof brain !== 'object') return { issues: ['brain.json missing or malformed'], warnings: [], score: 0 };

  const c = brain.constraints || {};
  if (c.maxPriceChangePercent !== undefined) {
    if (typeof c.maxPriceChangePercent !== 'number') issues.push('constraints.maxPriceChangePercent must be a number');
    else if (c.maxPriceChangePercent < 1 || c.maxPriceChangePercent > 50) warnings.push(`constraints.maxPriceChangePercent = ${c.maxPriceChangePercent} is outside the safe range 1–50`);
  }
  if (c.minConfidenceToAutoApply !== undefined) {
    if (typeof c.minConfidenceToAutoApply !== 'number') issues.push('constraints.minConfidenceToAutoApply must be a number');
    else if (c.minConfidenceToAutoApply < 0 || c.minConfidenceToAutoApply > 1) issues.push('constraints.minConfidenceToAutoApply must be between 0 and 1');
    else if (c.minConfidenceToAutoApply < 0.5) warnings.push(`constraints.minConfidenceToAutoApply = ${c.minConfidenceToAutoApply} is very low — system may auto-apply unreliable decisions`);
  }
  if (c.minMarginAUD !== undefined && (typeof c.minMarginAUD !== 'number' || c.minMarginAUD < 0)) {
    issues.push('constraints.minMarginAUD must be a non-negative number');
  }

  const meta = brain.meta || {};
  if (meta.learningConfidence !== undefined && (meta.learningConfidence < 0 || meta.learningConfidence > 1)) {
    issues.push('brain.meta.learningConfidence must be between 0 and 1');
  }

  const score = issues.length === 0 ? 1 : Math.max(0, 1 - issues.length * 0.2);
  return { issues, warnings, score };
}

function validateIntelligenceReport(report) {
  if (!report || report === null) return { issues: [], warnings: ['intelligence-report.json is null — no report generated yet'], score: 1 };
  const issues = [], warnings = [];

  (report.priceRecommendations || []).forEach((r, i) => {
    if (!r.handle) issues.push(`priceRecommendations[${i}]: missing handle`);
    if (r.confidenceScore !== undefined && (r.confidenceScore < 0 || r.confidenceScore > 1)) {
      issues.push(`priceRecommendations[${i}]: confidenceScore ${r.confidenceScore} out of range`);
    }
    if (r.confidenceScore !== undefined && r.confidenceScore < 0.3) {
      warnings.push(`priceRecommendations[${i}] (${r.handle}): very low confidence ${r.confidenceScore} — should not auto-apply`);
    }
  });

  if (report.generatedAt && daysSince(report.generatedAt) > 2) {
    warnings.push(`Intelligence report is ${Math.round(daysSince(report.generatedAt))} days old — consider re-running`);
  }

  const score = issues.length === 0 ? 1 : Math.max(0, 1 - issues.length * 0.15);
  return { issues, warnings, score };
}

// ── Cross-source consistency checks ───────────────────────────────────────

function crossSourceConsistency(products, analytics, competitorPrices, intelligenceReport) {
  const warnings = [];
  const productHandles = new Set((products || []).map(p => p.handle));

  // Analytics product views reference valid handles
  const analyticsProducts = new Set();
  (analytics?.sessions || []).forEach(s => (s.products || []).forEach(h => analyticsProducts.add(h)));
  analyticsProducts.forEach(h => {
    if (!productHandles.has(h)) warnings.push(`Analytics references unknown product handle "${h}" — orphaned data`);
  });

  // Intelligence report references valid handles
  (intelligenceReport?.priceRecommendations || []).forEach(r => {
    if (r.handle && !productHandles.has(r.handle)) {
      warnings.push(`Intelligence report references unknown handle "${r.handle}" — possible hallucination`);
    }
  });
  (intelligenceReport?.productRanking || []).forEach(h => {
    if (!productHandles.has(h)) warnings.push(`Intelligence ranking references unknown handle "${h}"`);
  });

  return { warnings };
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const health = await loadJSON('data/data-health.json', token, { lastChecked: null, sources: {} });
    const quarantine = await loadJSON('data/quarantine.json', token, { items: [] });
    return jsonResponse({ health: health.data, quarantineCount: (quarantine.data?.items || []).length });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));

  // Load all data sources
  const [productsRes, analyticsRes, compPricesRes, trendsRes, brainRes, intelRes, healthRes, quarantineRes] = await Promise.all([
    loadJSON('data/products.json', token, []),
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/competitor-prices.json', token, {}),
    loadJSON('data/trends.json', token, { daily: [], weekly: [] }),
    loadJSON('data/brain.json', token, {}),
    loadJSON('data/intelligence-report.json', token, null),
    loadJSON('data/data-health.json', token, { lastChecked: null, sources: {} }),
    loadJSON('data/quarantine.json', token, { items: [] }),
  ]);

  const productHandles = new Set((productsRes.data || []).map(p => p.handle));

  // Run all validators
  const results = {
    products: validateProducts(productsRes.data),
    analytics: validateAnalytics(analyticsRes.data),
    competitorPrices: validateCompetitorPrices(compPricesRes.data, productHandles),
    trends: validateTrends(trendsRes.data),
    brain: validateBrain(brainRes.data),
    intelligenceReport: validateIntelligenceReport(intelRes.data),
  };

  const crossCheck = crossSourceConsistency(
    productsRes.data, analyticsRes.data, compPricesRes.data, intelRes.data
  );

  // Aggregate scores
  const sourceScores = Object.values(results).map(r => r.score || 0);
  const overallScore = sourceScores.reduce((a, b) => a + b, 0) / sourceScores.length;

  const allIssues = Object.entries(results).flatMap(([src, r]) =>
    (r.issues || []).map(i => ({ source: src, severity: 'error', message: i }))
  );
  const allWarnings = Object.entries(results).flatMap(([src, r]) =>
    (r.warnings || []).map(w => ({ source: src, severity: 'warning', message: w }))
  ).concat(crossCheck.warnings.map(w => ({ source: 'cross-source', severity: 'warning', message: w })));

  // Quarantine: add new issues that look like data fabrication/hallucination
  const quarantineItems = quarantineRes.data?.items || [];
  const NOW = new Date().toISOString();
  const fabricationKeywords = ['future date', 'hallucination', 'unknown handle', 'orphaned'];
  const newQuarantineItems = [...allIssues, ...allWarnings].filter(i =>
    fabricationKeywords.some(kw => i.message.toLowerCase().includes(kw))
  ).map(i => ({
    source: i.source,
    severity: i.severity,
    message: i.message,
    detectedAt: NOW,
    reviewed: false,
  }));

  // Merge quarantine (avoid exact duplicates)
  const existingMessages = new Set(quarantineItems.map(i => i.message));
  const dedupedNew = newQuarantineItems.filter(i => !existingMessages.has(i.message));
  const updatedQuarantine = { items: [...quarantineItems, ...dedupedNew].slice(-200), lastChecked: NOW };

  // Update data-health.json
  const health = {
    lastChecked: NOW,
    overallScore: Math.round(overallScore * 100) / 100,
    belowThreshold: overallScore < MIN_QUALITY_TO_PROCEED,
    recommendation: overallScore < MIN_QUALITY_TO_PROCEED
      ? 'Data quality too low — auto-apply paused until issues resolved'
      : overallScore < 0.75
        ? 'Data quality acceptable but review warnings before acting'
        : 'Data quality good — system operating normally',
    sources: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, {
        score: Math.round((v.score || 0) * 100) / 100,
        issues: (v.issues || []).length,
        warnings: (v.warnings || []).length,
        ...(v.total !== undefined ? { total: v.total } : {}),
        ...(v.days !== undefined ? { days: v.days } : {}),
      }])
    ),
    totalIssues: allIssues.length,
    totalWarnings: allWarnings.length,
    newQuarantineItems: dedupedNew.length,
  };

  // Write health and quarantine back to GitHub
  await Promise.all([
    ghPut('data/data-health.json', JSON.stringify(health, null, 2), healthRes.sha, 'Data validation run', token),
    ghPut('data/quarantine.json', JSON.stringify(updatedQuarantine, null, 2), quarantineRes.sha, 'Update quarantine log', token),
  ]);

  return jsonResponse({
    overallScore,
    belowThreshold: health.belowThreshold,
    recommendation: health.recommendation,
    issues: allIssues,
    warnings: allWarnings,
    quarantineAdded: dedupedNew.length,
    sources: health.sources,
  });
}
