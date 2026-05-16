/**
 * Campaigns — read-only endpoint for loading saved campaign briefs.
 * Campaign generation is handled by campaign-strategist.js (POST /api/campaign-strategist).
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks' },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);
  try {
    const f = await ghGet('data/campaigns.json', token);
    const data = JSON.parse(atob(f.content.replace(/\s/g, '')));
    return jsonResponse(data);
  } catch (_) {
    return jsonResponse({ campaigns: [] });
  }
}
