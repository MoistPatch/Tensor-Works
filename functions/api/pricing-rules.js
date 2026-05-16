const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const PRICING_RULES_FILE = 'data/pricing-rules.json';

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
    throw new Error(e.message || 'GitHub PUT ' + path + ' failed: ' + r.status);
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
  if (!token) return jsonResponse({ error: 'GITHUB_PAT environment variable not set' }, 500);

  try {
    if (request.method === 'GET') {
      const file = await ghGet(PRICING_RULES_FILE, token);
      const rules = JSON.parse(atob(file.content.replace(/\s/g, '')));
      return jsonResponse({ rules, sha: file.sha });
    }

    if (request.method === 'POST') {
      const { rules } = await request.json();
      if (!rules || typeof rules !== 'object') {
        return jsonResponse({ error: 'rules must be an object' }, 400);
      }

      let sha = null;
      try {
        const existing = await ghGet(PRICING_RULES_FILE, token);
        sha = existing.sha;
      } catch (_) {}

      await ghPut(
        PRICING_RULES_FILE,
        JSON.stringify(rules, null, 2),
        sha,
        'Update pricing rules via admin panel',
        token
      );

      return jsonResponse({ success: true, message: 'Pricing rules saved' });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
