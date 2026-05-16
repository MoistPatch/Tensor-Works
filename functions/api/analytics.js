const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const MAX_SESSIONS = 500;

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

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildSummary(analytics) {
  const sessions = analytics.sessions || [];
  const productViews = analytics.productViews || {};
  const pageViews = analytics.pageViews || {};

  const date7 = dateNDaysAgo(7);
  const date30 = dateNDaysAgo(30);
  const sessions7 = sessions.filter(function(s) { return s.date >= date7; }).length;
  const sessions30 = sessions.filter(function(s) { return s.date >= date30; }).length;

  const topProducts = Object.entries(productViews)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(e) { return { handle: e[0], views: e[1] }; });

  const topPages = Object.entries(pageViews)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(e) { return { path: e[0], visits: e[1] }; });

  const recentSessions = sessions.slice(-20).reverse().map(function(s) {
    return {
      date: s.date,
      pagesCount: (s.pages || []).length,
      productsCount: (s.products || []).length,
      pages: (s.pages || []).map(function(p) { return p.path; }),
      products: s.products || [],
    };
  });

  return {
    sessions7d: sessions7,
    sessions30d: sessions30,
    totalSessions: sessions.length,
    uniqueProductsViewed: Object.keys(productViews).length,
    topProducts,
    topPages,
    recentSessions,
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  if (request.method === 'GET') {
    try {
      const file = await ghGet('data/analytics.json', token);
      const analytics = JSON.parse(atob(file.content.replace(/\n/g, '')));
      return jsonResponse(buildSummary(analytics));
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

    if (!body.session) return jsonResponse({ error: 'session is required' }, 400);

    try {
      const file = await ghGet('data/analytics.json', token);
      const analytics = JSON.parse(atob(file.content.replace(/\n/g, '')));

      const session = body.session;
      analytics.sessions = analytics.sessions || [];
      analytics.productViews = analytics.productViews || {};
      analytics.pageViews = analytics.pageViews || {};

      analytics.sessions.push(session);
      if (analytics.sessions.length > MAX_SESSIONS) {
        analytics.sessions = analytics.sessions.slice(-MAX_SESSIONS);
      }

      (session.products || []).forEach(function(handle) {
        analytics.productViews[handle] = (analytics.productViews[handle] || 0) + 1;
      });

      (session.pages || []).forEach(function(page) {
        const path = typeof page === 'string' ? page : page.path;
        if (path) analytics.pageViews[path] = (analytics.pageViews[path] || 0) + 1;
      });

      await ghPut('data/analytics.json', JSON.stringify(analytics, null, 2), file.sha, 'Analytics: session ' + (session.date || 'unknown'), token);
      return jsonResponse({ success: true });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
