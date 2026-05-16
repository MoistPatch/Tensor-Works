const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Admin' }
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
    body: JSON.stringify(body)
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT failed: ' + r.status); }
  return r.json();
}
async function loadJSON(path, token, fallback = null) {
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g,''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
function corsHeaders() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret' } });
}
function checkSecret(request, env) {
  if (!env.SYNC_SECRET) return true;
  const h = request.headers.get('X-Sync-Secret') || new URL(request.url).searchParams.get('secret');
  return h === env.SYNC_SECRET;
}
function callClaude(apiKey, system, user, maxTokens = 2048) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  }).then(r => r.json()).then(d => {
    const text = (d.content || [])[0]?.text || '';
    const clean = text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    return JSON.parse(clean);
  });
}

const BRAIN_PATH = 'data/brain.json';

async function logValidationToBrain(brain, brainSha, validationRecord, token) {
  if (!Array.isArray(brain.decisionLog)) brain.decisionLog = [];
  brain.decisionLog.push(validationRecord);
  if (brain.decisionLog.length > 200) {
    brain.decisionLog = brain.decisionLog.slice(-200);
  }
  brain.meta = brain.meta || {};
  brain.meta.lastUpdated = new Date().toISOString();
  await ghPut(BRAIN_PATH, JSON.stringify(brain, null, 2), brainSha, `safety-validator: logged validation for action ${validationRecord.actionType || 'unknown'}`, token);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return corsHeaders();

  if (!checkSecret(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const { data: brain } = await loadJSON(BRAIN_PATH, token, null);
    if (!brain) return jsonResponse({ error: 'brain.json not found' }, 404);
    return jsonResponse({ constraints: brain.constraints });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { action, context: actionContext } = body;
    if (!action) return jsonResponse({ error: 'action is required' }, 400);

    const { data: brain, sha: brainSha } = await loadJSON(BRAIN_PATH, token, null);
    if (!brain) return jsonResponse({ error: 'brain.json not found — cannot validate without constraints' }, 500);

    const constraints = brain.constraints || {};
    const result = {
      approved: true,
      confidence: action.confidence || 0,
      reason: 'All checks passed',
      requiresReview: false,
      deviationScore: 0,
      deviationReason: ''
    };

    // Check 1: confidence threshold
    const minConfidence = constraints.minConfidenceToAutoApply ?? 0.75;
    if (action.autoApply && (action.confidence == null || action.confidence < minConfidence)) {
      result.approved = false;
      result.reason = `Confidence ${action.confidence ?? 'unset'} is below minimum ${minConfidence} required for auto-apply`;
      result.requiresReview = true;
    }

    // Check 2: price change percent magnitude
    if (result.approved) {
      const maxPct = constraints.maxPriceChangePercent ?? 15;
      if (action.priceChangePercent != null && Math.abs(action.priceChangePercent) > maxPct) {
        result.approved = false;
        result.reason = `Price change of ${action.priceChangePercent}% exceeds maximum allowed ${maxPct}%`;
        result.requiresReview = true;
      }
    }

    // Check 3: AUD threshold
    if (result.approved) {
      const maxAUD = constraints.requireHumanApprovalAbove?.priceChangeAUD ?? 500;
      if (action.priceChangeAUD != null && Math.abs(action.priceChangeAUD) > maxAUD) {
        result.approved = false;
        result.reason = `Price change of AUD ${action.priceChangeAUD} requires human approval (threshold: AUD ${maxAUD})`;
        result.requiresReview = true;
      }
    }

    // Check 4: frozen product
    if (result.approved) {
      const frozen = constraints.frozenProducts || [];
      if (action.handle && frozen.includes(action.handle)) {
        result.approved = false;
        result.reason = `Product ${action.handle} is frozen — no automated changes allowed`;
        result.requiresReview = false;
      }
    }

    // Check 5: blacklisted action type
    if (result.approved) {
      const blacklisted = constraints.blacklistedActions || [];
      if (action.type && blacklisted.includes(action.type)) {
        result.approved = false;
        result.reason = `Action type "${action.type}" is blacklisted`;
        result.requiresReview = false;
      }
    }

    // Check 6: Claude deviation assessment (only if still approved and API key exists)
    if (result.approved && env.ANTHROPIC_API_KEY) {
      try {
        const skillsSummary = JSON.stringify(brain.skills || {}, null, 2);
        const actionSummary = JSON.stringify(action, null, 2);
        const contextSummary = actionContext ? JSON.stringify(actionContext, null, 2) : 'None provided';

        const deviationResult = await callClaude(
          env.ANTHROPIC_API_KEY,
          `You are a safety auditor for an AI-driven e-commerce pricing system. You assess whether a proposed action deviates from established learned patterns and could indicate erroneous or unsafe behaviour. Respond with a JSON object only — no prose.`,
          `Learned skills and patterns from brain:\n${skillsSummary}\n\nProposed action:\n${actionSummary}\n\nAdditional context:\n${contextSummary}\n\nRate how much this action deviates from the learned patterns. Return JSON: {"deviationScore": <0.0 to 1.0>, "deviationReason": "<brief explanation>", "flagForReview": <true|false>}`,
          512
        );

        result.deviationScore = typeof deviationResult.deviationScore === 'number' ? deviationResult.deviationScore : 0;
        result.deviationReason = deviationResult.deviationReason || '';

        if (deviationResult.flagForReview || result.deviationScore > 0.7) {
          result.approved = false;
          result.reason = `High deviation from learned patterns (score: ${result.deviationScore}): ${result.deviationReason}`;
          result.requiresReview = true;
        }
      } catch (err) {
        result.deviationReason = 'Deviation check skipped: ' + err.message;
      }
    }

    // Log the validation result to brain.json
    try {
      const validationRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'safety-validation',
        actionType: action.type,
        actionHandle: action.handle || null,
        approved: result.approved,
        reason: result.reason,
        requiresReview: result.requiresReview,
        deviationScore: result.deviationScore,
        confidence: action.confidence,
        autoApply: action.autoApply
      };
      await logValidationToBrain(brain, brainSha, validationRecord, token);
    } catch (logErr) {
      // Non-fatal — still return the validation result
      result.logError = logErr.message;
    }

    return jsonResponse(result);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
