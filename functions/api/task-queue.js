/**
 * Task Queue — async fire-and-forget task queue for worker processing.
 * GET: queue summary with pending tasks and recent completed.
 * POST actions: enqueue | dequeue | complete | fail | purge
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

const DATA_PATH = 'data/task-queue.json';
const FALLBACK = { tasks: [], processed: [] };

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET ───────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON(DATA_PATH, token, FALLBACK);
    const tasks = data.tasks || [];
    const processed = data.processed || [];

    const pending = tasks.filter(t => t.status === 'pending').length;
    const claimed = tasks.filter(t => t.status === 'claimed').length;
    const completed = processed.filter(t => t.status === 'completed').length;
    const failed = processed.filter(t => t.status === 'failed').length;
    const dead = processed.filter(t => t.status === 'dead').length;
    const recentCompleted = processed.filter(t => t.status === 'completed').slice(-10).reverse();
    const pendingTasks = tasks.filter(t => t.status === 'pending');

    return jsonResponse({ pending, claimed, completed, failed, dead, recentCompleted, pendingTasks });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // ── action: enqueue ───────────────────────────────────────────────────────
  if (action === 'enqueue') {
    const { type, payload, priority = 2, ttlHours = 24 } = body;
    if (!type || payload === undefined) return jsonResponse({ error: 'type and payload are required' }, 400);

    const { data, sha } = await loadJSON(DATA_PATH, token, FALLBACK);
    let tasks = data.tasks || [];
    let processed = data.processed || [];

    const now = new Date();
    const taskId = 'task-' + Date.now();
    const deadAfter = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

    tasks.push({
      taskId, type, payload,
      priority,
      status: 'pending',
      enqueuedAt: now.toISOString(),
      claimedAt: null,
      claimedBy: null,
      completedAt: null,
      result: null,
      error: null,
      retries: 0,
      maxRetries: 3,
      deadAfter,
    });

    // Cap at 500: remove oldest completed/failed from tasks array first, then just oldest
    if (tasks.length > 500) {
      const terminal = new Set(['completed', 'failed', 'dead']);
      const terminalTasks = tasks.filter(t => terminal.has(t.status));
      terminalTasks.sort((a, b) => new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime());
      const toRemove = new Set(terminalTasks.slice(0, tasks.length - 500).map(t => t.taskId));
      tasks = tasks.filter(t => !toRemove.has(t.taskId));
      if (tasks.length > 500) tasks = tasks.slice(tasks.length - 500);
    }

    // Sort pending by priority (1=high first) then enqueuedAt
    tasks.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'pending') {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime();
      }
      return 0;
    });

    data.tasks = tasks;
    data.processed = processed;
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Task enqueue: ${type} (${taskId})`, token);
    return jsonResponse({ enqueued: true, taskId });
  }

  // ── action: dequeue ───────────────────────────────────────────────────────
  if (action === 'dequeue') {
    const { claimedBy, type: typeFilter } = body;
    if (!claimedBy) return jsonResponse({ error: 'claimedBy required' }, 400);

    const { data, sha } = await loadJSON(DATA_PATH, token, FALLBACK);
    const tasks = data.tasks || [];
    const now = new Date();

    const idx = tasks.findIndex(t => {
      if (t.status !== 'pending') return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (new Date(t.deadAfter).getTime() <= now.getTime()) return false;
      return true;
    });

    if (idx < 0) return jsonResponse({ task: null });

    tasks[idx].status = 'claimed';
    tasks[idx].claimedAt = now.toISOString();
    tasks[idx].claimedBy = claimedBy;
    data.tasks = tasks;
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Task dequeue: ${tasks[idx].taskId} by ${claimedBy}`, token);
    return jsonResponse({ task: tasks[idx] });
  }

  // ── action: complete ──────────────────────────────────────────────────────
  if (action === 'complete') {
    const { taskId, result = null } = body;
    if (!taskId) return jsonResponse({ error: 'taskId required' }, 400);

    const { data, sha } = await loadJSON(DATA_PATH, token, FALLBACK);
    let tasks = data.tasks || [];
    let processed = data.processed || [];

    const idx = tasks.findIndex(t => t.taskId === taskId);
    if (idx < 0) return jsonResponse({ error: 'Task not found' }, 404);

    const task = { ...tasks[idx], status: 'completed', completedAt: new Date().toISOString(), result };
    tasks.splice(idx, 1);
    processed.push(task);
    if (processed.length > 100) processed = processed.slice(processed.length - 100);

    data.tasks = tasks;
    data.processed = processed;
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Task complete: ${taskId}`, token);
    return jsonResponse({ completed: true });
  }

  // ── action: fail ──────────────────────────────────────────────────────────
  if (action === 'fail') {
    const { taskId, error = null } = body;
    if (!taskId) return jsonResponse({ error: 'taskId required' }, 400);

    const { data, sha } = await loadJSON(DATA_PATH, token, FALLBACK);
    let tasks = data.tasks || [];
    let processed = data.processed || [];

    const idx = tasks.findIndex(t => t.taskId === taskId);
    if (idx < 0) return jsonResponse({ error: 'Task not found' }, 404);

    const task = tasks[idx];

    if (task.retries < task.maxRetries) {
      task.retries += 1;
      task.status = 'pending';
      task.claimedAt = null;
      task.claimedBy = null;
      task.error = error;
      data.tasks = tasks;
      data.processed = processed;
      await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Task requeue: ${taskId} (retry ${task.retries})`, token);
      return jsonResponse({ requeued: true });
    } else {
      const dead = { ...task, status: 'dead', completedAt: new Date().toISOString(), error };
      tasks.splice(idx, 1);
      processed.push(dead);
      if (processed.length > 100) processed = processed.slice(processed.length - 100);
      data.tasks = tasks;
      data.processed = processed;
      await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Task dead: ${taskId}`, token);
      return jsonResponse({ dead: true });
    }
  }

  // ── action: purge ─────────────────────────────────────────────────────────
  if (action === 'purge') {
    const { data, sha } = await loadJSON(DATA_PATH, token, FALLBACK);
    let tasks = data.tasks || [];
    let processed = data.processed || [];
    const now = Date.now();
    const cutoff48h = 48 * 60 * 60 * 1000;
    const staleClaim = 30 * 60 * 1000;

    // Purge old processed entries (completed/failed/dead older than 48h)
    const beforeProcessed = processed.length;
    processed = processed.filter(t => {
      const completedAt = t.completedAt ? new Date(t.completedAt).getTime() : 0;
      return now - completedAt < cutoff48h;
    });
    const purged = beforeProcessed - processed.length;

    // Recover stale claimed tasks (claimed > 30 min ago → reset to pending)
    let recovered = 0;
    for (const task of tasks) {
      if (task.status !== 'claimed') continue;
      const claimedAt = task.claimedAt ? new Date(task.claimedAt).getTime() : 0;
      if (now - claimedAt > staleClaim) {
        task.status = 'pending';
        task.claimedAt = null;
        task.claimedBy = null;
        recovered++;
      }
    }

    data.tasks = tasks;
    data.processed = processed;
    await ghPut(DATA_PATH, JSON.stringify(data, null, 2), sha, `Task purge: removed ${purged}, recovered ${recovered}`, token);
    return jsonResponse({ purged, recovered });
  }

  return jsonResponse({ error: 'Unknown action. Use: enqueue | dequeue | complete | fail | purge' }, 400);
}
