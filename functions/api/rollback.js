/**
 * Rollback — versioned snapshots of brain.json.
 * Every major write to brain.json snapshots the previous state here.
 * Admin can revert to any of the last 10 snapshots.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
const MAX_SNAPSHOTS = 10;

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

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    const snaps = await loadJSON('data/brain-snapshots.json', token, { snapshots: [] });
    return jsonResponse({
      snapshots: (snaps.data?.snapshots || []).map((s, i) => ({
        index: i,
        label: s.label,
        createdAt: s.createdAt,
        reason: s.reason,
        totalRunCount: s.brain?.meta?.totalRunCount,
        learningConfidence: s.brain?.meta?.learningConfidence,
        constraintSummary: {
          maxPriceChangePercent: s.brain?.constraints?.maxPriceChangePercent,
          minConfidenceToAutoApply: s.brain?.constraints?.minConfidenceToAutoApply,
        },
      })),
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));

  // ── action: snapshot — save current brain state before a major write ──────
  if (body.action === 'snapshot') {
    const [brainRes, snapsRes] = await Promise.all([
      loadJSON('data/brain.json', token, {}),
      loadJSON('data/brain-snapshots.json', token, { snapshots: [] }),
    ]);

    const snap = {
      label: body.label || 'Manual snapshot',
      reason: body.reason || 'Pre-update snapshot',
      createdAt: new Date().toISOString(),
      brain: brainRes.data,
    };

    const snapshots = [snap, ...(snapsRes.data?.snapshots || [])].slice(0, MAX_SNAPSHOTS);
    await ghPut('data/brain-snapshots.json', JSON.stringify({ snapshots }, null, 2), snapsRes.sha, 'Snapshot brain state: ' + snap.label, token);

    return jsonResponse({ success: true, snapshotCount: snapshots.length, label: snap.label });
  }

  // ── action: rollback — restore brain to a previous snapshot ───────────────
  if (body.action === 'rollback') {
    const index = body.index;
    if (typeof index !== 'number') return jsonResponse({ error: 'index (number) required' }, 400);

    const [snapsRes, brainRes] = await Promise.all([
      loadJSON('data/brain-snapshots.json', token, { snapshots: [] }),
      loadJSON('data/brain.json', token, {}),
    ]);

    const snapshots = snapsRes.data?.snapshots || [];
    if (index < 0 || index >= snapshots.length) {
      return jsonResponse({ error: `Snapshot index ${index} not found (${snapshots.length} available)` }, 404);
    }

    const target = snapshots[index];
    if (!target.brain) return jsonResponse({ error: 'Snapshot has no brain data' }, 400);

    // Snapshot current state before rolling back
    const preRollback = {
      label: 'Pre-rollback snapshot',
      reason: `Auto-snapshot before rolling back to "${target.label}" (${target.createdAt})`,
      createdAt: new Date().toISOString(),
      brain: brainRes.data,
    };
    const updatedSnapshots = [preRollback, ...snapshots].slice(0, MAX_SNAPSHOTS);
    await ghPut('data/brain-snapshots.json', JSON.stringify({ snapshots: updatedSnapshots }, null, 2), snapsRes.sha, 'Pre-rollback snapshot', token);

    // Restore the brain
    const restoredBrain = {
      ...target.brain,
      meta: {
        ...(target.brain.meta || {}),
        lastRolledBackAt: new Date().toISOString(),
        rolledBackTo: target.label + ' (' + target.createdAt + ')',
      },
    };
    await ghPut('data/brain.json', JSON.stringify(restoredBrain, null, 2), brainRes.sha, `Rollback brain to: ${target.label}`, token);

    return jsonResponse({
      success: true,
      rolledBackTo: target.label,
      createdAt: target.createdAt,
      totalRunCount: target.brain?.meta?.totalRunCount,
    });
  }

  // ── action: clear-quarantine ──────────────────────────────────────────────
  if (body.action === 'clear-quarantine') {
    const indices = body.indices; // array of indices to mark reviewed, or 'all'
    const qRes = await loadJSON('data/quarantine.json', token, { items: [] });
    let items = qRes.data?.items || [];

    if (indices === 'all') {
      items = items.map(i => ({ ...i, reviewed: true, reviewedAt: new Date().toISOString() }));
    } else if (Array.isArray(indices)) {
      indices.forEach(idx => {
        if (items[idx]) { items[idx].reviewed = true; items[idx].reviewedAt = new Date().toISOString(); }
      });
    }

    await ghPut('data/quarantine.json', JSON.stringify({ items, lastChecked: qRes.data?.lastChecked }, null, 2), qRes.sha, 'Mark quarantine items reviewed', token);
    return jsonResponse({ success: true, reviewed: Array.isArray(indices) ? indices.length : items.length });
  }

  return jsonResponse({ error: 'Unknown action. Use: snapshot | rollback | clear-quarantine' }, 400);
}
