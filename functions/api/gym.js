/**
 * Gym — simulation parameter and formula manager for Tensor Works.
 * Allows the user to inject custom mathematical formulas and adjust
 * simulation parameters used by the temporal simulator.
 *
 * GET  → return gym-config.json (create default if absent)
 * POST → manage formulas and simulation params
 *   action: add-formula        — add a custom formula
 *   action: remove-formula     — remove a formula by id
 *   action: toggle-formula     — flip a formula's active boolean
 *   action: update-params      — merge provided keys into simulationParams
 *   action: set-confidence-threshold — update the confidence threshold
 *   action: add-note           — append a timestamped note
 *   action: reset              — reset simulationParams to defaults (keep formulas)
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

const DEFAULT_CONFIG = {
  formulas: [],
  simulationParams: {
    priceElasticity: -1.5,
    charmPricingLift: 0.08,
    baseLeadRate: 0.015,
    leadToQuoteRate: 0.40,
    quoteAcceptanceRate: 0.30,
    marketGrowthRate: 0.02,
    eventProbability: 0.10,
    seasonalAmplitude: 0.25,
  },
  confidenceThreshold: 0.95,
  notes: '',
};

const VALID_FORMULA_TYPES = ['price-elasticity', 'lead-rate', 'conversion-rate', 'seasonal', 'custom'];

async function saveConfig(config, sha, token) {
  return ghPut(
    'data/gym-config.json',
    JSON.stringify(config, null, 2),
    sha,
    'chore: update gym-config',
    token
  );
}

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

  // ── GET: return gym config ─────────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data, sha } = await loadJSON('data/gym-config.json', token, null);
    if (!data) {
      // File doesn't exist yet — create it with defaults
      try {
        await saveConfig(DEFAULT_CONFIG, null, token);
      } catch (_) {}
      return jsonResponse({ success: true, config: DEFAULT_CONFIG });
    }
    return jsonResponse({ success: true, config: data });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const { action } = body;
  if (!action) return jsonResponse({ error: 'action is required' }, 400);

  // Load current config
  const { data: rawConfig, sha } = await loadJSON('data/gym-config.json', token, null);
  const config = rawConfig ? { ...DEFAULT_CONFIG, ...rawConfig } : { ...DEFAULT_CONFIG };
  // Ensure nested defaults
  config.formulas = config.formulas || [];
  config.simulationParams = { ...DEFAULT_CONFIG.simulationParams, ...(config.simulationParams || {}) };
  config.confidenceThreshold = config.confidenceThreshold ?? 0.95;
  config.notes = config.notes ?? '';

  // ── action: add-formula ────────────────────────────────────────────────────
  if (action === 'add-formula') {
    const { name, description, type, parameters, source } = body;
    if (!name) return jsonResponse({ error: 'name is required' }, 400);
    if (!type || !VALID_FORMULA_TYPES.includes(type)) {
      return jsonResponse({ error: `type must be one of: ${VALID_FORMULA_TYPES.join(', ')}` }, 400);
    }
    if (!parameters || typeof parameters !== 'object') {
      return jsonResponse({ error: 'parameters object is required' }, 400);
    }

    if (config.formulas.length >= 50) {
      return jsonResponse({ error: 'Formula cap of 50 reached — remove unused formulas first' }, 400);
    }

    const formula = {
      id: 'formula-' + Date.now(),
      name,
      description: description || '',
      type,
      parameters,
      source: source || '',
      addedAt: new Date().toISOString(),
      active: true,
    };

    config.formulas.push(formula);
    await saveConfig(config, sha, token);
    return jsonResponse({ added: true, formula });
  }

  // ── action: remove-formula ─────────────────────────────────────────────────
  if (action === 'remove-formula') {
    const { id } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);
    const before = config.formulas.length;
    config.formulas = config.formulas.filter(f => f.id !== id);
    if (config.formulas.length === before) {
      return jsonResponse({ error: 'Formula not found: ' + id }, 404);
    }
    await saveConfig(config, sha, token);
    return jsonResponse({ removed: true });
  }

  // ── action: toggle-formula ─────────────────────────────────────────────────
  if (action === 'toggle-formula') {
    const { id } = body;
    if (!id) return jsonResponse({ error: 'id is required' }, 400);
    const formula = config.formulas.find(f => f.id === id);
    if (!formula) return jsonResponse({ error: 'Formula not found: ' + id }, 404);
    formula.active = !formula.active;
    await saveConfig(config, sha, token);
    return jsonResponse({ toggled: true, id, active: formula.active });
  }

  // ── action: update-params ──────────────────────────────────────────────────
  if (action === 'update-params') {
    const { params } = body;
    if (!params || typeof params !== 'object') {
      return jsonResponse({ error: 'params object is required' }, 400);
    }

    const errors = [];
    if (params.priceElasticity !== undefined && params.priceElasticity >= 0) {
      errors.push('priceElasticity must be < 0');
    }
    const rateFields = ['charmPricingLift', 'baseLeadRate', 'leadToQuoteRate', 'quoteAcceptanceRate', 'marketGrowthRate', 'eventProbability', 'seasonalAmplitude'];
    for (const field of rateFields) {
      if (params[field] !== undefined && (params[field] < 0 || params[field] > 1)) {
        errors.push(`${field} must be between 0 and 1`);
      }
    }
    if (errors.length > 0) return jsonResponse({ error: errors.join('; ') }, 400);

    // Merge only provided keys
    for (const [key, value] of Object.entries(params)) {
      if (key in DEFAULT_CONFIG.simulationParams || key in config.simulationParams) {
        config.simulationParams[key] = value;
      }
    }

    await saveConfig(config, sha, token);
    return jsonResponse({ updated: true, simulationParams: config.simulationParams });
  }

  // ── action: set-confidence-threshold ──────────────────────────────────────
  if (action === 'set-confidence-threshold') {
    const { threshold } = body;
    if (threshold === undefined || threshold === null) {
      return jsonResponse({ error: 'threshold is required' }, 400);
    }
    if (typeof threshold !== 'number' || threshold < 0.5 || threshold > 1.0) {
      return jsonResponse({ error: 'threshold must be a number between 0.5 and 1.0' }, 400);
    }
    config.confidenceThreshold = threshold;
    await saveConfig(config, sha, token);
    return jsonResponse({ updated: true, confidenceThreshold: config.confidenceThreshold });
  }

  // ── action: add-note ───────────────────────────────────────────────────────
  if (action === 'add-note') {
    const { note } = body;
    if (!note) return jsonResponse({ error: 'note is required' }, 400);
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${note}`;
    config.notes = config.notes ? config.notes + '\n' + entry : entry;
    await saveConfig(config, sha, token);
    return jsonResponse({ added: true, note: entry });
  }

  // ── action: reset ──────────────────────────────────────────────────────────
  if (action === 'reset') {
    config.simulationParams = { ...DEFAULT_CONFIG.simulationParams };
    await saveConfig(config, sha, token);
    return jsonResponse({ reset: true, simulationParams: config.simulationParams });
  }

  return jsonResponse({ error: 'Unknown action. Use: add-formula | remove-formula | toggle-formula | update-params | set-confidence-threshold | add-note | reset' }, 400);
}
