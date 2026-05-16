/**
 * Agent Manager — central registry for all spawned agents (Claude calls, pipeline tasks, orchestration runs).
 * GET: list agents with optional ?status= and ?runId= filters.
 * POST actions: spawn | kill | kill-all | heartbeat | complete | fail | cleanup
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

function summarize(agents) {
  return {
    total: agents.length,
    running: agents.filter(a => a.status === 'running').length,
    completed: agents.filter(a => a.status === 'completed').length,
    failed: agents.filter(a => a.status === 'failed').length,
    killed: agents.filter(a => a.status === 'killed').length,
  };
}

// Remove completed/failed/killed agents older than cutoffMs, then cap at maxCount keeping newest
function autoClean(agents, cutoffMs = 2 * 60 * 60 * 1000, maxCount = 200) {
  const now = Date.now();
  const terminal = new Set(['completed', 'failed', 'killed']);
  agents = agents.filter(a => {
    if (!terminal.has(a.status)) return true;
    const completedAt = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    return now - completedAt < cutoffMs;
  });
  if (agents.length > maxCount) {
    // Sort: running first, then by spawnedAt desc; drop oldest
    agents.sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1;
      if (b.status === 'running' && a.status !== 'running') return 1;
      return new Date(b.spawnedAt).getTime() - new Date(a.spawnedAt).getTime();
    });
    agents = agents.slice(0, maxCount);
  }
  return agents;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET ───────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const runIdFilter = url.searchParams.get('runId');

    const { data } = await loadJSON('data/agents.json', token, { agents: [] });
    let agents = data.agents || [];

    if (statusFilter) agents = agents.filter(a => a.status === statusFilter);
    if (runIdFilter) agents = agents.filter(a => a.parentRunId === runIdFilter);

    return jsonResponse({ agents, summary: summarize(data.agents || []) });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // ── action: spawn ─────────────────────────────────────────────────────────
  if (action === 'spawn') {
    const { agentId, type, task, parentRunId = null } = body;
    if (!agentId || !type || !task) return jsonResponse({ error: 'agentId, type, and task are required' }, 400);

    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    let agents = data.agents || [];

    const now = new Date().toISOString();
    const existing = agents.findIndex(a => a.agentId === agentId);
    const agentRecord = {
      agentId, type, task, parentRunId,
      status: 'running',
      killSignal: false,
      spawnedAt: now,
      lastHeartbeat: now,
      completedAt: null,
      result: null,
      error: null,
    };

    if (existing >= 0) {
      agents[existing] = agentRecord;
    } else {
      agents.push(agentRecord);
    }

    agents = autoClean(agents);
    data.agents = agents;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent spawn: ${agentId}`, token);
    return jsonResponse({ spawned: true, agentId });
  }

  // ── action: kill ──────────────────────────────────────────────────────────
  if (action === 'kill') {
    const { agentId } = body;
    if (!agentId) return jsonResponse({ error: 'agentId required' }, 400);

    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    const agents = data.agents || [];
    const idx = agents.findIndex(a => a.agentId === agentId);
    if (idx < 0) return jsonResponse({ error: 'Agent not found' }, 404);

    const now = new Date().toISOString();
    agents[idx].killSignal = true;
    agents[idx].status = 'killed';
    agents[idx].completedAt = now;
    data.agents = agents;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent kill: ${agentId}`, token);
    return jsonResponse({ killed: true, agentId });
  }

  // ── action: kill-all ──────────────────────────────────────────────────────
  if (action === 'kill-all') {
    const { type: typeFilter } = body;

    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    const agents = data.agents || [];
    const now = new Date().toISOString();
    let killed = 0;

    for (const agent of agents) {
      if (agent.status !== 'running') continue;
      if (typeFilter && agent.type !== typeFilter) continue;
      agent.killSignal = true;
      agent.status = 'killed';
      agent.completedAt = now;
      killed++;
    }

    data.agents = agents;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent kill-all${typeFilter ? ' type:' + typeFilter : ''}`, token);
    return jsonResponse({ killed });
  }

  // ── action: heartbeat ─────────────────────────────────────────────────────
  if (action === 'heartbeat') {
    const { agentId } = body;
    if (!agentId) return jsonResponse({ error: 'agentId required' }, 400);

    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    const agents = data.agents || [];
    const idx = agents.findIndex(a => a.agentId === agentId);
    if (idx < 0) return jsonResponse({ error: 'Agent not found' }, 404);

    agents[idx].lastHeartbeat = new Date().toISOString();
    data.agents = agents;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent heartbeat: ${agentId}`, token);

    const killSignal = agents[idx].killSignal;
    if (killSignal) return jsonResponse({ alive: false, killSignal: true });
    return jsonResponse({ alive: true, killSignal: false });
  }

  // ── action: complete ──────────────────────────────────────────────────────
  if (action === 'complete') {
    const { agentId, result = null } = body;
    if (!agentId) return jsonResponse({ error: 'agentId required' }, 400);

    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    const agents = data.agents || [];
    const idx = agents.findIndex(a => a.agentId === agentId);
    if (idx < 0) return jsonResponse({ error: 'Agent not found' }, 404);

    agents[idx].status = 'completed';
    agents[idx].completedAt = new Date().toISOString();
    agents[idx].result = result;
    data.agents = agents;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent complete: ${agentId}`, token);
    return jsonResponse({ completed: true });
  }

  // ── action: fail ──────────────────────────────────────────────────────────
  if (action === 'fail') {
    const { agentId, error = null } = body;
    if (!agentId) return jsonResponse({ error: 'agentId required' }, 400);

    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    const agents = data.agents || [];
    const idx = agents.findIndex(a => a.agentId === agentId);
    if (idx < 0) return jsonResponse({ error: 'Agent not found' }, 404);

    agents[idx].status = 'failed';
    agents[idx].completedAt = new Date().toISOString();
    agents[idx].error = error;
    data.agents = agents;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent fail: ${agentId}`, token);
    return jsonResponse({ failed: true });
  }

  // ── action: cleanup ───────────────────────────────────────────────────────
  if (action === 'cleanup') {
    const { data, sha } = await loadJSON('data/agents.json', token, { agents: [] });
    const agents = data.agents || [];
    const before = agents.length;
    const cutoff24h = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const terminal = new Set(['completed', 'failed', 'killed']);

    data.agents = agents.filter(a => {
      if (!terminal.has(a.status)) return true;
      const completedAt = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      return now - completedAt < cutoff24h;
    });

    const removed = before - data.agents.length;
    await ghPut('data/agents.json', JSON.stringify(data, null, 2), sha, `Agent cleanup: removed ${removed}`, token);
    return jsonResponse({ removed });
  }

  return jsonResponse({ error: 'Unknown action. Use: spawn | kill | kill-all | heartbeat | complete | fail | cleanup' }, 400);
}
