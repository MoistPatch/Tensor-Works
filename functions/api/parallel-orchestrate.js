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

const TASK_DAG = {
  'forex':            { deps: [],                                                timeout: 12000 },
  'data-validator':   { deps: [],                                                timeout: 20000 },
  'competitor-crawl': { deps: [],                                                timeout: 25000 },
  'trend-analyst':    { deps: [],                                                timeout: 15000 },
  'anomaly-detector': { deps: ['trend-analyst', 'competitor-crawl'],             timeout: 20000 },
  'multi-agent-intel':{ deps: ['competitor-crawl', 'trend-analyst', 'anomaly-detector'], timeout: 28000 },
  'memory-manager':   { deps: ['multi-agent-intel'],                             timeout: 20000 },
  'reporting':        { deps: ['multi-agent-intel'],                             timeout: 20000 },
  'brain-update':     { deps: ['memory-manager', 'reporting'],                  timeout: 10000 },
  'monitor':          { deps: ['brain-update'],                                  timeout: 15000 },
};

async function runMultiAgentIntel(token, anthropicKey, agentRunId, siteUrl, signal) {
  const [productsRes, analyticsRes, competitorRes, trendsRes, brainRes, anomaliesRes] = await Promise.all([
    loadJSON('data/products.json', token, []),
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/competitor-prices.json', token, { products: [] }),
    loadJSON('data/trends.json', token, { daily: [], weekly: [] }),
    loadJSON('data/brain.json', token, {}),
    loadJSON('data/anomalies.json', token, { anomalies: [] }),
  ]);

  const ctx = {
    products: (productsRes.data || []).slice(0, 20).map(p => ({ handle: p.handle, title: p.title, priceIncGst: p.priceIncGst, costExGst: p.costExGst, category: p.category })),
    recentSessions: (analyticsRes.data?.sessions || []).length,
    competitorProducts: (competitorRes.data?.products || []).slice(0, 10),
    recentTrends: (trendsRes.data?.daily || []).slice(-14),
    constraints: brainRes.data?.constraints || {},
    recentAnomalies: (anomaliesRes.data?.anomalies || (brainRes.data?.history?.anomaliesDetected) || []).slice(0, 5),
  };

  const pricingSystem = 'You are a B2B hardware pricing specialist for an Australian GPU/AI hardware retailer. Analyse the data and return ONLY valid JSON: { "recommendations": [{ "handle": "product-handle", "currentPrice": 0, "suggestedPrice": 0, "rationale": "string", "confidence": 0.0-1.0, "urgency": "high|medium|low" }], "pricingInsights": "string" }';
  const competitorSystem = 'You are a competitive intelligence analyst for an Australian B2B AI hardware retailer. Analyse competitor pricing data and return ONLY valid JSON: { "threats": [{ "productHandle": "string", "competitorSite": "string", "priceDifferential": "string", "recommendation": "string" }], "opportunities": [{ "description": "string", "action": "string" }], "competitivePosition": "strong|neutral|weak", "summary": "string" }';
  const demandSystem = 'You are a demand forecasting analyst for an Australian B2B AI hardware retailer. Analyse traffic and trend data and return ONLY valid JSON: { "demandSignals": [{ "productHandle": "string|null", "signal": "string", "strength": "high|medium|low", "actionable": true }], "forecastSummary": "string", "recommendedStockActions": [{ "handle": "string", "action": "increase|decrease|monitor", "reason": "string" }] }';
  const riskSystem = 'You are a business risk analyst for an Australian B2B AI hardware retailer. Analyse anomalies and business data and return ONLY valid JSON: { "risks": [{ "type": "string", "severity": "high|medium|low", "description": "string", "mitigationAction": "string" }], "overallRiskLevel": "high|medium|low", "riskSummary": "string" }';

  const claudeCall = async (agentName, system, userMsg) => {
    const agentId = agentRunId + '-' + agentName;
    try {
      await fetch(siteUrl + '/api/agent-manager', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spawn', agentId, type: agentName, task: 'multi-agent-intel', parentRunId: agentRunId }),
      });
    } catch(_) {}

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: 1024, system, messages: [{ role: 'user', content: userMsg }] }),
      });
      const d = await r.json();
      const text = (d.content || [])[0]?.text || '{}';
      const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const result = JSON.parse(clean);
      try { await fetch(siteUrl + '/api/agent-manager', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'complete', agentId, result }) }); } catch(_) {}
      return { agentName, success: true, result };
    } catch (err) {
      try { await fetch(siteUrl + '/api/agent-manager', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'fail', agentId, error: err.message }) }); } catch(_) {}
      return { agentName, success: false, error: err.message };
    }
  };

  const [pricingResult, competitorResult, demandResult, riskResult] = await Promise.allSettled([
    claudeCall('pricing-agent', pricingSystem, JSON.stringify({ focus: 'pricing', data: ctx })),
    claudeCall('competitor-agent', competitorSystem, JSON.stringify({ focus: 'competitive', data: ctx })),
    claudeCall('demand-agent', demandSystem, JSON.stringify({ focus: 'demand', data: ctx })),
    claudeCall('risk-agent', riskSystem, JSON.stringify({ focus: 'risk', data: ctx })),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    agentRunId,
    agents: {
      pricing: pricingResult.status === 'fulfilled' ? pricingResult.value.result : null,
      competitor: competitorResult.status === 'fulfilled' ? competitorResult.value.result : null,
      demand: demandResult.status === 'fulfilled' ? demandResult.value.result : null,
      risk: riskResult.status === 'fulfilled' ? riskResult.value.result : null,
    },
    agentStatuses: {
      pricing: pricingResult.status,
      competitor: competitorResult.status,
      demand: demandResult.status,
      risk: riskResult.status,
    },
  };

  const existing = await loadJSON('data/multi-agent-report.json', token, []);
  const history = Array.isArray(existing.data) ? existing.data : [];
  history.unshift(report);
  if (history.length > 10) history.splice(10);
  await ghPut('data/multi-agent-report.json', JSON.stringify(history, null, 2), existing.sha, 'Multi-agent intel report: ' + report.generatedAt, token);

  return { success: true, agentsRun: 4, report };
}

async function runDAG(tasks, siteUrl, token, anthropicKey, agentRunId) {
  const state = {};
  for (const name of Object.keys(tasks)) {
    state[name] = 'pending';
  }
  const results = {};

  const dispatchTask = async (name) => {
    const { timeout } = tasks[name];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const start = Date.now();
    try {
      let result;
      if (name === 'multi-agent-intel') {
        result = await runMultiAgentIntel(token, anthropicKey, agentRunId, siteUrl, controller.signal);
      } else {
        let url = `${siteUrl}/api/${name}`;
        let body = {};
        if (name === 'data-validator') {
          body = { action: 'validate-all' };
        } else if (name === 'brain-update') {
          url = `${siteUrl}/api/brain`;
          body = { action: 'update', path: 'meta.lastOrchestrationAt', value: new Date().toISOString() };
        }
        const r = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        result = await r.json().catch(() => ({}));
      }
      clearTimeout(timer);
      const duration = Date.now() - start;
      state[name] = 'completed';
      results[name] = { status: 'completed', duration, result };
    } catch (err) {
      clearTimeout(timer);
      const duration = Date.now() - start;
      if (err.name === 'AbortError') {
        state[name] = 'killed';
        results[name] = { status: 'killed', duration, error: 'Timeout after ' + timeout + 'ms' };
      } else {
        state[name] = 'failed';
        results[name] = { status: 'failed', duration, error: err.message };
      }
    }
  };

  while (Object.values(state).some(s => s === 'pending')) {
    const ready = Object.keys(tasks).filter(name => {
      if (state[name] !== 'pending') return false;
      return tasks[name].deps.every(dep => state[dep] === 'completed' || state[dep] === 'failed' || state[dep] === 'killed');
    });
    if (ready.length === 0) break;
    for (const name of ready) {
      state[name] = 'running';
    }
    await Promise.allSettled(ready.map(name => dispatchTask(name)));
  }

  return results;
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const token = context.env.GITHUB_PAT;
  const anthropicKey = context.env.ANTHROPIC_API_KEY;
  const siteUrl = context.env.SITE_URL || 'https://tensorworks.online';

  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  const agentRunId = 'run-' + Date.now();
  const pipelineStart = Date.now();

  try {
    await fetch(siteUrl + '/api/agent-manager', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'spawn', agentId: agentRunId, type: 'parallel-orchestrator', task: 'full-pipeline' }),
    });
  } catch(_) {}

  const taskResults = await runDAG(TASK_DAG, siteUrl, token, anthropicKey, agentRunId);

  try {
    await fetch(siteUrl + '/api/agent-manager', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', agentId: agentRunId, result: { tasks: Object.keys(taskResults).length } }),
    });
  } catch(_) {}

  const totalDuration = Date.now() - pipelineStart;
  const succeeded = Object.values(taskResults).filter(t => t.status === 'completed').length;
  const failed = Object.values(taskResults).filter(t => t.status === 'failed').length;
  const killed = Object.values(taskResults).filter(t => t.status === 'killed').length;

  return jsonResponse({ success: true, agentRunId, totalDuration, succeeded, failed, killed, tasks: taskResults });
}
