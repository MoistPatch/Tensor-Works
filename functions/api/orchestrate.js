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

export async function onRequest(context) {
  if (context.request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  const siteUrl = context.env.SITE_URL || 'https://tensorworks.online';
  const pipelineStart = Date.now();
  const steps = [];

  const postStep = async (stepName, url, body = {}) => {
    const start = Date.now();
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      const duration = Date.now() - start;
      steps.push({ step: stepName, success: r.ok, duration, ...(r.ok ? {} : { error: data.error || 'HTTP ' + r.status }) });
      return { ok: r.ok, data };
    } catch (e) {
      const duration = Date.now() - start;
      steps.push({ step: stepName, success: false, duration, error: e.message });
      return { ok: false, data: {} };
    }
  };

  const validatorResult = await postStep('data-validator', siteUrl + '/api/data-validator', { action: 'validate-all' });
  if (validatorResult.ok && typeof validatorResult.data.overallScore === 'number' && validatorResult.data.overallScore < 0.5) {
    return jsonResponse({ stopped: true, reason: 'Data quality too low', dataHealth: validatorResult.data });
  }

  await postStep('competitor-crawl', siteUrl + '/api/competitor-crawl');
  await postStep('trend-analyst', siteUrl + '/api/trend-analyst');
  await postStep('anomaly-detector', siteUrl + '/api/anomaly-detector');
  await postStep('intelligence', siteUrl + '/api/intelligence');
  await postStep('memory-manager', siteUrl + '/api/memory-manager');
  await postStep('brain', siteUrl + '/api/brain', { action: 'update', path: 'meta.lastOrchestrationAt', value: new Date().toISOString() });

  const completedAt = new Date().toISOString();
  const totalDuration = Date.now() - pipelineStart;
  return jsonResponse({ success: true, steps, totalDuration, completedAt });
}
