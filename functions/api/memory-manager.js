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
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

function callClaude(apiKey, system, user, maxTokens = 2048) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  }).then(r => r.json()).then(d => {
    const text = (d.content || [])[0]?.text || '';
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(clean);
  });
}

function computeDataQualityScore(intelligenceReport, trends, analytics, competitorPrices, decisions) {
  let score = 0;
  let sourcesPresent = 0;

  if (intelligenceReport && Object.keys(intelligenceReport).length > 0) sourcesPresent++;
  if (trends && (trends.daily || []).length > 0) sourcesPresent++;
  if (analytics && (analytics.sessions || []).length > 0) sourcesPresent++;
  if (competitorPrices && Object.keys(competitorPrices).length > 0) sourcesPresent++;
  if (decisions && (Array.isArray(decisions) ? decisions : decisions.decisions || []).length > 0) sourcesPresent++;

  score += (sourcesPresent / 5) * 0.4;

  const dailyDays = (trends?.daily || []).length;
  if (dailyDays >= 30) score += 0.3;
  else if (dailyDays >= 14) score += 0.2;
  else if (dailyDays >= 7) score += 0.1;
  else if (dailyDays >= 1) score += 0.05;

  const sessions = (analytics?.sessions || []).length;
  if (sessions >= 500) score += 0.2;
  else if (sessions >= 100) score += 0.12;
  else if (sessions >= 10) score += 0.05;

  const competitorCount = Object.keys(competitorPrices || {}).length;
  if (competitorCount >= 5) score += 0.1;
  else if (competitorCount >= 2) score += 0.06;
  else if (competitorCount >= 1) score += 0.03;

  return Math.min(1, Math.round(score * 100) / 100);
}

function computeLearningConfidence(brain, trends) {
  let score = 0;

  const runCount = brain.meta?.totalRunCount || 0;
  if (runCount >= 50) score += 0.35;
  else if (runCount >= 20) score += 0.25;
  else if (runCount >= 10) score += 0.15;
  else if (runCount >= 3) score += 0.08;
  else if (runCount >= 1) score += 0.03;

  const daily = trends?.daily || [];
  if (daily.length >= 2) {
    const sessionValues = daily.map(d => d.sessions || 0).filter(s => s > 0);
    if (sessionValues.length >= 2) {
      const mean = sessionValues.reduce((a, b) => a + b, 0) / sessionValues.length;
      const variance = sessionValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sessionValues.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      const consistencyScore = Math.max(0, 1 - cv);
      score += consistencyScore * 0.35;
    }
  }

  const anomaliesCount = (brain.history?.anomaliesDetected || []).length;
  const priceChangesCount = (brain.history?.priceChanges || []).length;
  const patternsCount = Object.keys(brain.patterns || {}).filter(k => {
    const v = brain.patterns[k];
    return v && typeof v === 'object' && Object.keys(v).length > 0;
  }).length;

  if (anomaliesCount >= 10) score += 0.1;
  else if (anomaliesCount >= 3) score += 0.05;

  if (priceChangesCount >= 10) score += 0.1;
  else if (priceChangesCount >= 3) score += 0.05;

  if (patternsCount >= 3) score += 0.1;
  else if (patternsCount >= 1) score += 0.05;

  return Math.min(1, Math.round(score * 100) / 100);
}

function mergeSkills(brainSkills, newSkills) {
  for (const { category, skill, evidence } of newSkills) {
    if (!category || !skill) continue;
    if (!brainSkills[category]) brainSkills[category] = {};
    const key = skill.toLowerCase().replace(/\s+/g, '_').slice(0, 60);
    brainSkills[category][key] = { skill, evidence, learnedAt: new Date().toISOString() };
  }
}

function mergePatterns(brainPatterns, updatedPatterns) {
  for (const [key, value] of Object.entries(updatedPatterns || {})) {
    if (value && typeof value === 'object') {
      brainPatterns[key] = { ...(brainPatterns[key] || {}), ...value };
    } else if (value !== undefined) {
      brainPatterns[key] = value;
    }
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const token = env.GITHUB_TOKEN;
  const apiKey = env.ANTHROPIC_API_KEY;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const defaultBrain = {
    skills: { pricing: {}, products: { topPerformers: [], slowMovers: [] }, competitors: {}, campaigns: {} },
    history: { priceChanges: [], intelligenceRuns: [], anomaliesDetected: [] },
    patterns: { weeklyTrafficShape: {}, productViewCorrelations: {}, priceElasticityByCategory: {}, competitorResponseLag: {} },
    meta: { totalRunCount: 0, dataQualityScore: 0, learningConfidence: 0, notes: [] }
  };

  try {
    if (request.method === 'GET') {
      const { data: brain } = await loadJSON('data/brain.json', token, defaultBrain);
      const skillsSummary = {};
      for (const [category, skills] of Object.entries(brain.skills || {})) {
        if (Array.isArray(skills)) {
          skillsSummary[category] = skills.length;
        } else if (typeof skills === 'object') {
          skillsSummary[category] = Object.keys(skills).length;
        }
      }
      return jsonResponse({ meta: brain.meta || {}, skillsSummary });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const [
      { data: brain, sha: brainSha },
      { data: intelligenceReport },
      { data: trends },
      { data: analytics },
      { data: competitorPrices },
      { data: decisions }
    ] = await Promise.all([
      loadJSON('data/brain.json', token, defaultBrain),
      loadJSON('data/intelligence-report.json', token, {}),
      loadJSON('data/trends.json', token, { daily: [], weekly: [], monthly: [], lastUpdated: null }),
      loadJSON('data/analytics.json', token, { sessions: [] }),
      loadJSON('data/competitor-prices.json', token, {}),
      loadJSON('data/decisions.json', token, { decisions: [] })
    ]);

    const dataQualityScore = computeDataQualityScore(intelligenceReport, trends, analytics, competitorPrices, decisions);
    const learningConfidence = computeLearningConfidence(brain, trends);

    const topTrends = (trends.daily || []).slice(-7).map(d => ({
      date: d.date,
      sessions: d.sessions,
      topProduct: d.topProduct
    }));

    const recentAnomalies = (brain.history?.anomaliesDetected || []).slice(-10).map(a => ({
      type: a.type,
      description: a.description,
      severity: a.severity,
      detectedAt: a.detectedAt
    }));

    const reportSummary = {
      summary: intelligenceReport.summary || intelligenceReport.insight || '',
      recommendations: intelligenceReport.recommendations || [],
      highlights: intelligenceReport.highlights || intelligenceReport.keyFindings || [],
      generatedAt: intelligenceReport.generatedAt || intelligenceReport.timestamp || null
    };

    const learnings = await callClaude(
      apiKey,
      'You are a learning system. Extract durable patterns and skills from this intelligence report that should be stored for future reference. Return JSON only.',
      `Extract learnings from this intelligence data and return a JSON object with keys: newSkills (array of {category, skill, evidence}), updatedPatterns (object of pattern updates), notableInsights (array of strings).

Intelligence report: ${JSON.stringify(reportSummary)}

Recent daily trends: ${JSON.stringify(topTrends)}

Recent anomalies detected: ${JSON.stringify(recentAnomalies)}`,
      2048
    ).catch(() => ({ newSkills: [], updatedPatterns: {}, notableInsights: [] }));

    if (!brain.skills) brain.skills = defaultBrain.skills;
    if (!brain.patterns) brain.patterns = defaultBrain.patterns;
    if (!brain.history) brain.history = defaultBrain.history;
    if (!brain.meta) brain.meta = defaultBrain.meta;
    if (!Array.isArray(brain.meta.notes)) brain.meta.notes = [];

    mergeSkills(brain.skills, learnings.newSkills || []);
    mergePatterns(brain.patterns, learnings.updatedPatterns || {});

    for (const insight of (learnings.notableInsights || [])) {
      brain.meta.notes.push({ note: insight, addedAt: new Date().toISOString() });
    }
    brain.meta.notes = brain.meta.notes.slice(-100);

    brain.meta.dataQualityScore = dataQualityScore;
    brain.meta.learningConfidence = learningConfidence;
    brain.meta.totalRunCount = (brain.meta.totalRunCount || 0) + 1;
    brain.meta.lastUpdated = new Date().toISOString();

    const decisionsArray = Array.isArray(decisions) ? decisions : (decisions.decisions || []);
    if (!Array.isArray(brain.history.anomaliesDetected)) brain.history.anomaliesDetected = [];
    if (!Array.isArray(brain.history.priceChanges)) brain.history.priceChanges = [];
    if (!Array.isArray(brain.history.intelligenceRuns)) brain.history.intelligenceRuns = [];

    brain.history.intelligenceRuns.push({
      runAt: new Date().toISOString(),
      dataQualityScore,
      learningConfidence,
      newSkillsLearned: (learnings.newSkills || []).length,
      insightsExtracted: (learnings.notableInsights || []).length
    });

    brain.history.anomaliesDetected = brain.history.anomaliesDetected.slice(-100);
    brain.history.priceChanges = brain.history.priceChanges.slice(-50);
    brain.history.intelligenceRuns = brain.history.intelligenceRuns.slice(-200);

    await ghPut('data/brain.json', JSON.stringify(brain, null, 2), brainSha, 'Update brain memory with latest learnings', token);

    return jsonResponse({
      updated: true,
      dataQualityScore,
      learningConfidence,
      newSkillsLearned: (learnings.newSkills || []).length,
      notableInsights: learnings.notableInsights || [],
      totalRunCount: brain.meta.totalRunCount
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
