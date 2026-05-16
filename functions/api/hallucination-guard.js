/**
 * Hallucination Guard — wraps Claude calls to detect and score grounding.
 * Every factual claim Claude makes is checked against the source data
 * that was passed to it. Ungrounded claims are flagged and scored down.
 * Also runs dual-pass consistency checking for high-stakes decisions.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

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

// ── Grounding checker ─────────────────────────────────────────────────────
// Verifies that claims in the output are traceable to the input context.

async function checkGrounding(apiKey, originalOutput, contextData) {
  const system = `You are a fact-checking agent. Your job is to verify that every factual claim in an AI-generated output is directly supported by the provided source data. Be strict and sceptical. Return ONLY valid JSON.`;

  const user = `Verify every factual claim in this AI output against the source data.

AI OUTPUT TO CHECK:
${typeof originalOutput === 'string' ? originalOutput : JSON.stringify(originalOutput, null, 2)}

SOURCE DATA (the only data the AI had access to):
${JSON.stringify(contextData, null, 2).slice(0, 8000)}

For each claim you can identify:
1. Is it directly supported by specific data in the source? (grounded)
2. Is it a reasonable inference from the data? (inferred — acceptable)
3. Is it absent from or contradicted by the source data? (ungrounded — flag this)
4. Does it reference specific numbers/percentages — verify they match the source exactly?

Return:
{
  "groundingScore": 0.0,
  "groundedClaims": ["claim that is directly supported"],
  "inferredClaims": ["reasonable inference from data"],
  "ungroundedClaims": ["claim not supported by source data"],
  "contradictedClaims": ["claim that contradicts the source data"],
  "fabricatedNumbers": ["any specific numbers not found in source"],
  "verdict": "grounded|mostly-grounded|partially-grounded|ungrounded",
  "summary": "one sentence assessment"
}`;

  const text = await callClaude(apiKey, system, [{ role: 'user', content: user }], 2048);
  return parseJSON(text);
}

// ── Dual-pass consistency check ───────────────────────────────────────────
// Runs the same prompt twice and compares outputs. Inconsistency = hallucination risk.

async function dualPassCheck(apiKey, systemPrompt, userPrompt, contextData) {
  const baseMessages = [{ role: 'user', content: userPrompt }];

  // Run twice in parallel
  const [pass1Text, pass2Text] = await Promise.all([
    callClaude(apiKey, systemPrompt, baseMessages, 2048),
    callClaude(apiKey, systemPrompt, baseMessages, 2048),
  ]);

  let pass1, pass2;
  try { pass1 = parseJSON(pass1Text); } catch (_) { pass1 = null; }
  try { pass2 = parseJSON(pass2Text); } catch (_) { pass2 = null; }

  if (!pass1 || !pass2) {
    return { consistent: false, consistencyScore: 0, reason: 'One or both passes failed to produce valid JSON' };
  }

  // Ask Claude to compare the two outputs for consistency
  const compareSystem = `You are a consistency checker. Compare two AI outputs and assess how consistent they are. Return ONLY valid JSON.`;
  const compareUser = `Compare these two outputs from the same AI prompt and assess consistency.

OUTPUT 1:
${JSON.stringify(pass1, null, 2)}

OUTPUT 2:
${JSON.stringify(pass2, null, 2)}

Check: Do they reach the same conclusions? Are the numbers similar? Do they contradict each other?

Return:
{
  "consistencyScore": 0.0,
  "consistent": true,
  "contradictions": ["specific contradiction found"],
  "agreedPoints": ["points both outputs agree on"],
  "recommendation": "use-pass1|use-pass2|merge|unreliable"
}`;

  const compText = await callClaude(apiKey, compareSystem, [{ role: 'user', content: compareUser }], 1024);
  const comparison = parseJSON(compText);

  return {
    consistent: comparison.consistent,
    consistencyScore: comparison.consistencyScore,
    contradictions: comparison.contradictions || [],
    agreedPoints: comparison.agreedPoints || [],
    recommendation: comparison.recommendation,
    pass1,
    pass2,
    mergedOutput: comparison.recommendation === 'use-pass2' ? pass2 : pass1,
  };
}

// ── Confidence decay ──────────────────────────────────────────────────────
// Reduces confidence score based on data age and volume.

function applyConfidenceDecay(baseConfidence, dataContext) {
  let confidence = baseConfidence;
  const decay = [];

  // Age decay: each day of data staleness reduces confidence
  if (dataContext.lastAnalysisAge !== undefined) {
    const agePenalty = Math.min(0.3, dataContext.lastAnalysisAge * 0.05);
    confidence -= agePenalty;
    if (agePenalty > 0) decay.push(`-${(agePenalty * 100).toFixed(0)}% data age (${dataContext.lastAnalysisAge} days)`);
  }

  // Volume decay: low data volume reduces confidence
  if (dataContext.sessionCount !== undefined && dataContext.sessionCount < 10) {
    const volumePenalty = (10 - dataContext.sessionCount) * 0.02;
    confidence -= volumePenalty;
    decay.push(`-${(volumePenalty * 100).toFixed(0)}% low session count (${dataContext.sessionCount})`);
  }

  // Quality decay: low data quality score reduces confidence
  if (dataContext.dataQualityScore !== undefined && dataContext.dataQualityScore < 0.8) {
    const qualityPenalty = (0.8 - dataContext.dataQualityScore) * 0.5;
    confidence -= qualityPenalty;
    decay.push(`-${(qualityPenalty * 100).toFixed(0)}% data quality (score: ${(dataContext.dataQualityScore * 100).toFixed(0)}%)`);
  }

  // Competitor data decay: no competitor data significantly reduces pricing confidence
  if (dataContext.competitorDataCount !== undefined && dataContext.competitorDataCount === 0) {
    confidence -= 0.15;
    decay.push('-15% no competitor price data');
  }

  return {
    originalConfidence: baseConfidence,
    adjustedConfidence: Math.max(0, Math.min(1, confidence)),
    decayFactors: decay,
    decayTotal: baseConfidence - Math.max(0, Math.min(1, confidence)),
  };
}

// ── Drift detector ────────────────────────────────────────────────────────
// Detects if recommendations are drifting too far from historical norms.

function detectDrift(currentRecommendations, historicalDecisions) {
  const driftFlags = [];
  if (!currentRecommendations || !Array.isArray(historicalDecisions)) return { driftDetected: false, flags: [] };

  // Build historical recommendation map
  const historicalByHandle = {};
  historicalDecisions.forEach(d => {
    if (d.type === 'price-recommendation' && d.relatedHandles) {
      d.relatedHandles.forEach(h => {
        historicalByHandle[h] = historicalByHandle[h] || [];
        historicalByHandle[h].push(d);
      });
    }
  });

  // Check for unusual recommendation frequency on same product
  const currentHandles = (currentRecommendations || []).map(r => r.handle).filter(Boolean);
  currentHandles.forEach(handle => {
    const history = historicalByHandle[handle] || [];
    const recentHistory = history.filter(d => {
      const age = d.timestamp ? (Date.now() - new Date(d.timestamp).getTime()) / 86400000 : Infinity;
      return age <= 7;
    });
    if (recentHistory.length >= 3) {
      driftFlags.push({
        handle,
        flag: `Product "${handle}" has been recommended for change ${recentHistory.length} times in the last 7 days — possible oscillation`,
        severity: 'warning',
      });
    }
  });

  // Check for simultaneous large-scale changes (>50% of products recommended at once)
  if (currentHandles.length > 0) {
    // This would need product count context — flag if >6 products recommended simultaneously
    if (currentHandles.length > 6) {
      driftFlags.push({
        flag: `${currentHandles.length} simultaneous price recommendations — unusually broad scope, review carefully`,
        severity: 'warning',
      });
    }
  }

  return {
    driftDetected: driftFlags.some(f => f.severity === 'critical'),
    flags: driftFlags,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const { mode, systemPrompt, userPrompt, output, contextData, confidenceDecayContext, recommendations, historicalDecisions } = body;

  try {
    switch (mode) {
      case 'check-grounding': {
        // Verify an existing output against its source data
        if (!output || !contextData) return jsonResponse({ error: 'output and contextData required' }, 400);
        const result = await checkGrounding(apiKey, output, contextData);
        return jsonResponse(result);
      }

      case 'dual-pass': {
        // Run a prompt twice and check consistency
        if (!systemPrompt || !userPrompt || !contextData) return jsonResponse({ error: 'systemPrompt, userPrompt, and contextData required' }, 400);
        const result = await dualPassCheck(apiKey, systemPrompt, userPrompt, contextData);
        return jsonResponse(result);
      }

      case 'confidence-decay': {
        // Apply confidence decay factors to a base score
        if (body.baseConfidence === undefined || !confidenceDecayContext) return jsonResponse({ error: 'baseConfidence and confidenceDecayContext required' }, 400);
        const result = applyConfidenceDecay(body.baseConfidence, confidenceDecayContext);
        return jsonResponse(result);
      }

      case 'drift-detect': {
        // Detect if recommendations are drifting
        const result = detectDrift(recommendations, historicalDecisions || []);
        return jsonResponse(result);
      }

      case 'full-check': {
        // Run all checks on a Claude output before it gets used
        if (!output || !contextData) return jsonResponse({ error: 'output and contextData required' }, 400);
        const [grounding, drift] = await Promise.all([
          checkGrounding(apiKey, output, contextData),
          Promise.resolve(detectDrift(output?.priceRecommendations, historicalDecisions || [])),
        ]);
        const decay = confidenceDecayContext
          ? applyConfidenceDecay(grounding.groundingScore, confidenceDecayContext)
          : null;

        const finalScore = decay ? decay.adjustedConfidence : grounding.groundingScore;
        const passed = finalScore >= 0.6 && grounding.contradictedClaims.length === 0;

        return jsonResponse({
          passed,
          finalScore,
          grounding,
          drift,
          decay,
          recommendation: passed
            ? 'Output is grounded and safe to use'
            : `Output has quality issues — review before applying (score: ${(finalScore * 100).toFixed(0)}%)`,
        });
      }

      default:
        return jsonResponse({ error: `Unknown mode "${mode}". Use: check-grounding | dual-pass | confidence-decay | drift-detect | full-check` }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
