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

export async function onRequest(context) {
  const { request, env } = context;
  const token = env.GITHUB_PAT;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (request.method === 'GET') {
    const [sitesResult, pricesResult] = await Promise.all([
      loadJSON('data/competitor-sites.json', token, { sites: [] }),
      loadJSON('data/competitor-prices.json', token, { lastCrawled: null, products: [] }),
    ]);
    return jsonResponse({
      sites: sitesResult.data.sites,
      products: pricesResult.data.products,
      lastCrawled: pricesResult.data.lastCrawled,
    });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (_) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const { action, url, name } = body;
    if (!action) return jsonResponse({ error: 'Missing action' }, 400);

    const { data: sitesData, sha: sitesSha } = await loadJSON('data/competitor-sites.json', token, { sites: [] });
    let sites = sitesData.sites;

    if (action === 'add') {
      if (!url || !name) return jsonResponse({ error: 'Missing url or name' }, 400);
      const exists = sites.some(s => s.url === url);
      if (!exists) {
        sites.push({ url, name, addedAt: new Date().toISOString(), lastCrawledAt: null });
      }
      await ghPut('data/competitor-sites.json', JSON.stringify({ sites }, null, 2), sitesSha, 'Add competitor site: ' + name, token);
      return jsonResponse({ success: true, sites });
    }

    if (action === 'remove') {
      if (!url) return jsonResponse({ error: 'Missing url' }, 400);
      sites = sites.filter(s => s.url !== url);
      await ghPut('data/competitor-sites.json', JSON.stringify({ sites }, null, 2), sitesSha, 'Remove competitor site: ' + url, token);
      return jsonResponse({ success: true, sites });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
