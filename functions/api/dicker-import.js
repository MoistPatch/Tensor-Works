const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const PRODUCTS_FILE = 'data/products.json';
const IMPORT_QUEUE_FILE = 'data/import-queue.json';
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
    '  products: ' + JSON.stringify(products, null, 2).split('\n').map(function(l, i) { return i === 0 ? l : '  ' + l; }).join('\n') + ',\n' +
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
      // Read import queue from GitHub
      let queue = [];
      let sha = null;
      try {
        const file = await ghGet(IMPORT_QUEUE_FILE, token);
        queue = JSON.parse(atob(file.content.replace(/\s/g, '')));
        sha = file.sha;
      } catch (_) {
        // Queue file may not exist yet — return empty
      }
      return jsonResponse({ queue, sha });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { action } = body;

      if (!action) return jsonResponse({ error: 'action is required' }, 400);

      // ---- action: add ----
      if (action === 'add') {
        const { products } = body;
        if (!Array.isArray(products) || products.length === 0) {
          return jsonResponse({ error: 'products must be a non-empty array' }, 400);
        }

        // Read current queue
        let queue = [];
        let queueSha = null;
        try {
          const qFile = await ghGet(IMPORT_QUEUE_FILE, token);
          queue = JSON.parse(atob(qFile.content.replace(/\s/g, '')));
          queueSha = qFile.sha;
        } catch (_) {}

        // Add new products with status "pending" and timestamp
        const now = new Date().toISOString();
        for (const p of products) {
          queue.push({ ...p, status: 'pending', importedAt: now });
        }

        await ghPut(
          IMPORT_QUEUE_FILE,
          JSON.stringify(queue, null, 2),
          queueSha,
          'Add ' + products.length + ' product(s) to import queue',
          token
        );

        return jsonResponse({ success: true, message: products.length + ' product(s) added to queue', queueLength: queue.length });
      }

      // ---- action: approve ----
      if (action === 'approve') {
        const { indices } = body;
        if (!Array.isArray(indices) || indices.length === 0) {
          return jsonResponse({ error: 'indices must be a non-empty array' }, 400);
        }

        // Read current queue
        const qFile = await ghGet(IMPORT_QUEUE_FILE, token);
        let queue = JSON.parse(atob(qFile.content.replace(/\s/g, '')));
        const queueSha = qFile.sha;

        // Read current products
        let products = [];
        let productsSha = null;
        try {
          const pFile = await ghGet(PRODUCTS_FILE, token);
          products = JSON.parse(atob(pFile.content.replace(/\s/g, '')));
          productsSha = pFile.sha;
        } catch (_) {}

        // Extract approved items (sorted descending to preserve indices on splice)
        const sortedIndices = [...indices].sort((a, b) => b - a);
        const approved = [];
        for (const idx of sortedIndices) {
          if (idx >= 0 && idx < queue.length) {
            const [item] = queue.splice(idx, 1);
            approved.unshift(item);
          }
        }

        // Convert Dicker Data products to site product schema
        const now = new Date().toISOString();
        for (const item of approved) {
          const handle = (item.description || item.sku || 'product-' + Date.now())
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          products.push({
            handle,
            title: item.description || item.sku,
            category: item.category || 'GPU Accelerators',
            sku: item.sku || item.manufacturerSku || '',
            priceDisplay: item.displayPrice || 'POA',
            shopifyVariantId: null,
            image: null,
            iconClass: 'teal',
            icon: 'fa-microchip',
            description: item.description || '',
            specs: [],
            inStock: item.inStock !== undefined ? item.inStock : true,
            tags: [item.manufacturer, item.category].filter(Boolean),
            _importedFrom: 'dicker',
            _importedAt: now,
          });
        }

        // Save updated products.json
        await ghPut(
          PRODUCTS_FILE,
          JSON.stringify(products, null, 2),
          productsSha,
          'Import ' + approved.length + ' product(s) from Dicker Data queue',
          token
        );

        // Regenerate config.js
        const configFile = await ghGet(CONFIG_FILE, token);
        await ghPut(
          CONFIG_FILE,
          generateConfigJS(products),
          configFile.sha,
          'Regenerate config.js after Dicker Data import',
          token
        );

        // Save updated queue (with approved items removed)
        await ghPut(
          IMPORT_QUEUE_FILE,
          JSON.stringify(queue, null, 2),
          queueSha,
          'Remove ' + approved.length + ' approved product(s) from import queue',
          token
        );

        return jsonResponse({
          success: true,
          message: approved.length + ' product(s) approved and added to site',
          approved: approved.length,
          queueRemaining: queue.length,
          totalProducts: products.length,
        });
      }

      // ---- action: reject ----
      if (action === 'reject') {
        const { indices } = body;
        if (!Array.isArray(indices) || indices.length === 0) {
          return jsonResponse({ error: 'indices must be a non-empty array' }, 400);
        }

        // Read current queue
        const qFile = await ghGet(IMPORT_QUEUE_FILE, token);
        let queue = JSON.parse(atob(qFile.content.replace(/\s/g, '')));
        const queueSha = qFile.sha;

        // Remove rejected items (sorted descending to preserve indices)
        const sortedIndices = [...indices].sort((a, b) => b - a);
        let rejectedCount = 0;
        for (const idx of sortedIndices) {
          if (idx >= 0 && idx < queue.length) {
            queue.splice(idx, 1);
            rejectedCount++;
          }
        }

        await ghPut(
          IMPORT_QUEUE_FILE,
          JSON.stringify(queue, null, 2),
          queueSha,
          'Reject ' + rejectedCount + ' product(s) from import queue',
          token
        );

        return jsonResponse({
          success: true,
          message: rejectedCount + ' product(s) rejected and removed from queue',
          rejected: rejectedCount,
          queueRemaining: queue.length,
        });
      }

      return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
