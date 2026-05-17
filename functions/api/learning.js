/**
 * Learning — store and retrieve notes that feed into intelligence analysis.
 * GET: return all notes. POST actions: add, delete, clear-category.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
const FILE = 'data/learning-notes.json';
const CATEGORIES = ['Market Intelligence', 'Supplier Pricing', 'Customer Feedback', 'Competitor Intel', 'Industry News', 'Custom'];

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks' },
  });
  if (!r.ok) throw new Error('GitHub GET ' + r.status);
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
async function load(token) {
  try {
    const f = await ghGet(FILE, token);
    return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha };
  } catch (_) {
    return { data: { notes: [] }, sha: null };
  }
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
    const { data } = await load(token);
    return jsonResponse({ notes: data.notes || [], categories: CATEGORIES });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;
  const { data, sha } = await load(token);
  data.notes = data.notes || [];

  if (action === 'add') {
    const { title, content, category = 'Custom' } = body;
    if (!content?.trim()) return jsonResponse({ error: 'content is required' }, 400);
    const note = {
      id: Date.now(),
      title: title?.trim() || '',
      content: content.trim(),
      category,
      addedAt: new Date().toISOString(),
    };
    data.notes.unshift(note);
    if (data.notes.length > 100) data.notes = data.notes.slice(0, 100);
    await ghPut(FILE, JSON.stringify(data, null, 2), sha, `Learning: add note "${note.title || category}"`, token);
    return jsonResponse({ added: true, note });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return jsonResponse({ error: 'id required' }, 400);
    const before = data.notes.length;
    data.notes = data.notes.filter(n => String(n.id) !== String(id));
    await ghPut(FILE, JSON.stringify(data, null, 2), sha, 'Learning: delete note', token);
    return jsonResponse({ deleted: before !== data.notes.length });
  }

  if (action === 'clear-category') {
    const { category } = body;
    if (!category) return jsonResponse({ error: 'category required' }, 400);
    data.notes = data.notes.filter(n => n.category !== category);
    await ghPut(FILE, JSON.stringify(data, null, 2), sha, `Learning: clear category "${category}"`, token);
    return jsonResponse({ cleared: true });
  }

  return jsonResponse({ error: 'Unknown action. Use: add | delete | clear-category' }, 400);
}
