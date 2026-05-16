/**
 * Monitor — health monitoring for all system endpoints.
 * GET: return monitor-log.json. POST: run health checks against all known endpoints.
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
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g,''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

const endpoints = [
  { name: 'brain', path: '/api/brain' },
  { name: 'analytics', path: '/api/analytics' },
  { name: 'competitors', path: '/api/competitors' },
  { name: 'data-validator', path: '/api/data-validator' },
  { name: 'intelligence-report', path: '/api/intelligence' },
  { name: 'quotes', path: '/api/quote' },
  { name: 'monitor', path: '/api/monitor' },
];

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return monitor-log.json ──────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/monitor-log.json', token, { checks: [], lastRun: null, overallStatus: 'unknown' });
    return jsonResponse(data || { checks: [], lastRun: null, overallStatus: 'unknown' });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const siteUrl = env.SITE_URL || 'https://tensorworks.online';

  // ── Run endpoint health checks in parallel ────────────────────────────────
  const endpointChecks = await Promise.allSettled(
    endpoints.map(async ({ name, path }) => {
      const url = siteUrl + path;
      const startMs = Date.now();
      const checkedAt = new Date().toISOString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const responseTimeMs = Date.now() - startMs;
        let status;
        if (r.status >= 200 && r.status < 300) {
          status = responseTimeMs < 3000 ? 'ok' : 'degraded';
        } else {
          status = 'down';
        }
        return { name, url, status, httpStatus: r.status, responseTimeMs, checkedAt, error: null };
      } catch (e) {
        clearTimeout(timeout);
        const responseTimeMs = Date.now() - startMs;
        return { name, url, status: 'down', httpStatus: null, responseTimeMs, checkedAt, error: e.message };
      }
    })
  );

  const checks = endpointChecks.map(r => r.status === 'fulfilled' ? r.value : { name: 'unknown', url: null, status: 'down', httpStatus: null, responseTimeMs: null, checkedAt: new Date().toISOString(), error: 'Promise rejected' });

  // ── Check data freshness from brain.json ──────────────────────────────────
  try {
    const brainFile = await ghGet('data/brain.json', token);
    const brain = JSON.parse(atob(brainFile.content.replace(/\s/g, '')));
    const lastOrch = brain?.meta?.lastOrchestrationAt;
    const checkedAt = new Date().toISOString();
    if (!lastOrch || (Date.now() - new Date(lastOrch).getTime()) > 26 * 60 * 60 * 1000) {
      checks.push({
        name: 'stale-orchestration',
        url: null,
        status: 'degraded',
        httpStatus: null,
        responseTimeMs: null,
        checkedAt,
        error: lastOrch ? `Last orchestration was at ${lastOrch}` : 'lastOrchestrationAt is null',
      });
    }
  } catch (_) {
    // Non-fatal: skip freshness check if brain.json can't be read
  }

  // ── Compute overall status ────────────────────────────────────────────────
  const hasDown = checks.some(c => c.status === 'down');
  const hasDegraded = checks.some(c => c.status === 'degraded');
  const overallStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'ok';

  const runId = Date.now();
  const runRecord = { runId, checkedAt: new Date().toISOString(), overallStatus, checks };

  // ── Load, update, and save monitor-log.json ───────────────────────────────
  const { data: log, sha } = await loadJSON('data/monitor-log.json', token, { checks: [], lastRun: null, overallStatus: 'unknown' });
  const updatedLog = log || { checks: [], lastRun: null, overallStatus: 'unknown' };
  updatedLog.checks = [runRecord, ...(updatedLog.checks || [])].slice(0, 50);
  updatedLog.lastRun = runRecord.checkedAt;
  updatedLog.overallStatus = overallStatus;

  await ghPut('data/monitor-log.json', JSON.stringify(updatedLog, null, 2), sha, 'Monitor: health check run', token);

  // ── Alert if any endpoint is down ────────────────────────────────────────
  if (hasDown) {
    const downEndpoints = checks.filter(c => c.status === 'down').map(c => c.name);
    try {
      await fetch(`${siteUrl}/api/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'monitor',
          title: 'System health check failed',
          message: downEndpoints.join(', ') + ' returned errors',
          urgency: 'high',
          data: { checks },
        }),
      });
    } catch (_) {
      // Non-fatal
    }
  }

  return jsonResponse({ success: true, overallStatus, checks, runId });
}
