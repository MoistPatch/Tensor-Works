const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const PRODUCTS_FILE = 'data/products.json';
const CONFIG_FILE = 'js/config.js';

function generateConfigJS(products) {
  return 'window.TW = {\n' +
    '  shopify: {\n' +
    '    domain: \'ituspq-hc.myshopify.com\',\n' +
    '    configured: true,\n' +
    '  },\n' +
    '  dickerData: {\n' +
    '    stockProxy: \'/api/stock\',\n' +
    '    pricingProxy: \'/api/pricing\',\n' +
    '    enabled: false,\n' +
    '  },\n' +
    '  products: ' + JSON.stringify(products, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n') + ',\n' +
    '};\n';
}

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
      let products = [], sha = null;
      try {
        const file = await ghGet(PRODUCTS_FILE, token);
        products = JSON.parse(atob(file.content.replace(/\s/g, '')));
        sha = file.sha;
      } catch (e) {
        // products.json may not exist yet — return empty
      }
      return jsonResponse({ products, sha });
    }

    if (request.method === 'POST') {
      const { products, sha } = await request.json();
      if (!Array.isArray(products)) return jsonResponse({ error: 'products must be an array' }, 400);

      // Write products.json
      let productsSha = sha;
      if (!productsSha) {
        try { productsSha = (await ghGet(PRODUCTS_FILE, token)).sha; } catch (_) {}
      }
      await ghPut(PRODUCTS_FILE, JSON.stringify(products, null, 2), productsSha, 'Update products via admin panel', token);

      // Regenerate and write config.js
      const configFile = await ghGet(CONFIG_FILE, token);
      await ghPut(CONFIG_FILE, generateConfigJS(products), configFile.sha, 'Regenerate config.js from admin product update', token);

      return jsonResponse({ success: true, message: 'Saved — site deploying in ~60 seconds' });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
