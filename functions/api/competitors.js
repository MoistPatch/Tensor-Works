const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TensorWorks-Admin',
    },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}

async function ghPut(path, content, sha, message, token) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded };
  if (sha) body.sha = sha;
  const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TensorWorks-Admin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || 'GitHub PUT failed: ' + r.status);
  }
  return r.json();
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function generateId() {
  return 'comp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
      },
    });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    try {
      const [sitesFile, pricesFile] = await Promise.all([
        ghGet('data/competitor-sites.json', token),
        ghGet('data/competitor-prices.json', token),
      ]);
      const sites = JSON.parse(atob(sitesFile.content.replace(/\n/g, '')));
      const prices = JSON.parse(atob(pricesFile.content.replace(/\n/g, '')));
      return jsonResponse({ sites, prices, sitesSha: sitesFile.sha, pricesSha: pricesFile.sha });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    try {
      const [sitesFile, pricesFile] = await Promise.all([
        ghGet('data/competitor-sites.json', token),
        ghGet('data/competitor-prices.json', token),
      ]);
      let sites = JSON.parse(atob(sitesFile.content.replace(/\n/g, '')));
      let prices = JSON.parse(atob(pricesFile.content.replace(/\n/g, '')));

      if (body.action === 'add') {
        const site = body.site;
        if (!site || !site.name || !site.url) {
          return jsonResponse({ error: 'name and url are required' }, 400);
        }
        const newSite = {
          id: generateId(),
          name: site.name,
          url: site.url,
          catalogueUrl: site.catalogueUrl || site.url,
          lastCrawled: null,
          lastStatus: null,
          productCount: 0,
        };
        sites.push(newSite);
        await ghPut('data/competitor-sites.json', JSON.stringify(sites, null, 2), sitesFile.sha, 'Add competitor: ' + site.name, token);
        return jsonResponse({ success: true, site: newSite });
      }

      if (body.action === 'remove') {
        if (!body.id) return jsonResponse({ error: 'id is required' }, 400);
        sites = sites.filter(function(s) { return s.id !== body.id; });
        delete prices[body.id];
        await Promise.all([
          ghPut('data/competitor-sites.json', JSON.stringify(sites, null, 2), sitesFile.sha, 'Remove competitor: ' + body.id, token),
          ghPut('data/competitor-prices.json', JSON.stringify(prices, null, 2), pricesFile.sha, 'Clear prices for removed competitor', token),
        ]);
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
