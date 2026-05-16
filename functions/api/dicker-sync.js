const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const PRODUCTS_FILE = 'data/products.json';
const QUEUE_FILE = 'data/import-queue.json';
const DICKER_CATALOG_URL = 'https://api.dickerdata.com.au/api/v2/product/getall';

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

async function fetchDickerCatalog(apiKey) {
  const r = await fetch(DICKER_CATALOG_URL, {
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Accept': 'application/json',
    },
  });
  if (!r.ok) throw new Error('Dicker Data API failed: ' + r.status);
  const data = await r.json();
  return data.products || data.data || data || [];
}

function normalizeDickerProduct(p) {
  return {
    handle: (p.partNumber || p.sku || p.productCode || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: p.description || p.name || p.partNumber || '',
    category: p.category || p.productGroup || 'Uncategorised',
    sku: p.partNumber || p.sku || p.productCode || '',
    costExGst: parseFloat(p.buyPrice || p.cost || p.price || 0),
    priceDisplay: 'POA',
    image: p.imageUrl || p.image || null,
    description: p.longDescription || p.description || '',
    inStock: (p.stockOnHand || p.stock || 0) > 0,
    stockQty: p.stockOnHand || p.stock || 0,
    source: 'dicker-data',
  };
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
      },
    });
  }

  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Require sync secret to prevent unauthorized triggers
  const syncSecret = env.SYNC_SECRET;
  if (syncSecret) {
    const provided = request.headers.get('X-Sync-Secret') || new URL(request.url).searchParams.get('secret');
    if (provided !== syncSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  const dickerKey = env.DICKER_DATA_API_KEY;
  const githubToken = env.GITHUB_PAT;

  if (!githubToken) return jsonResponse({ error: 'GITHUB_PAT not set' }, 500);
  if (!dickerKey) return jsonResponse({ skipped: true, reason: 'DICKER_DATA_API_KEY not configured yet' });

  try {
    // Load existing products and import queue
    const [productsFile, queueFile, costChangesFile] = await Promise.all([
      ghGet(PRODUCTS_FILE, githubToken).catch(() => null),
      ghGet(QUEUE_FILE, githubToken).catch(() => null),
      ghGet('data/cost-changes.json', githubToken).catch(() => null),
    ]);

    const existingProducts = productsFile
      ? JSON.parse(atob(productsFile.content.replace(/\s/g, '')))
      : [];
    const queue = queueFile
      ? JSON.parse(atob(queueFile.content.replace(/\s/g, '')))
      : [];

    const existingSkus = new Set(existingProducts.map(p => p.sku));
    const queuedSkus = new Set(queue.map(p => p.sku));

    // Fetch live Dicker Data catalog
    const dickerProducts = await fetchDickerCatalog(dickerKey);
    const normalized = dickerProducts.map(normalizeDickerProduct).filter(p => p.sku);

    // Cost change detection
    const costChanges = [];
    const COST_CHANGE_THRESHOLD = 0.05; // 5%
    const timestamp = new Date().toISOString();
    for (const newProd of normalized) {
      const existing = existingProducts.find(p => p.sku === newProd.sku);
      if (!existing || !existing.costExGst || !newProd.costExGst) continue;
      const pctChange = (newProd.costExGst - existing.costExGst) / existing.costExGst;
      if (Math.abs(pctChange) >= COST_CHANGE_THRESHOLD) {
        costChanges.push({
          sku: newProd.sku,
          title: newProd.title,
          oldCost: existing.costExGst,
          newCost: newProd.costExGst,
          pctChange: Math.round(pctChange * 1000) / 10, // one decimal
          direction: pctChange > 0 ? 'increase' : 'decrease',
          detectedAt: timestamp,
        });
      }
    }

    // Find products not already imported or queued
    const newProducts = normalized.filter(p => !existingSkus.has(p.sku) && !queuedSkus.has(p.sku));

    if (costChanges.length === 0 && newProducts.length === 0) {
      return jsonResponse({ synced: true, newProducts: 0, costChanges: 0, totalFetched: normalized.length });
    }

    // Add new products to import queue
    const newQueueItems = newProducts.map(p => ({ ...p, status: 'pending', queuedAt: timestamp }));
    const updatedQueue = [...queue, ...newQueueItems];

    // Update costs on existing products
    for (const change of costChanges) {
      const idx = existingProducts.findIndex(p => p.sku === change.sku);
      if (idx >= 0) existingProducts[idx].costExGst = change.newCost;
    }

    const puts = [
      ghPut(
        QUEUE_FILE,
        JSON.stringify(updatedQueue, null, 2),
        queueFile ? queueFile.sha : null,
        'Dicker Data hourly sync: ' + newProducts.length + ' new product(s) queued',
        githubToken
      ),
      ghPut(
        PRODUCTS_FILE,
        JSON.stringify(existingProducts, null, 2),
        productsFile ? productsFile.sha : null,
        'Dicker Data sync: update cost prices',
        githubToken
      ),
    ];

    if (costChanges.length > 0) {
      const existingChanges = costChangesFile
        ? JSON.parse(atob(costChangesFile.content.replace(/\s/g, '')))
        : { changes: [] };
      existingChanges.changes = [...costChanges, ...existingChanges.changes].slice(0, 200);
      puts.push(
        ghPut(
          'data/cost-changes.json',
          JSON.stringify(existingChanges, null, 2),
          costChangesFile ? costChangesFile.sha : null,
          'Dicker Data sync: ' + costChanges.length + ' cost change(s) detected',
          githubToken
        )
      );
    }

    await Promise.all(puts);

    return jsonResponse({
      synced: true,
      newProducts: newProducts.length,
      totalFetched: normalized.length,
      queuedSkus: newProducts.map(p => p.sku),
      costChanges: costChanges.length,
      ...(costChanges.length <= 10 ? { costChangeDetails: costChanges } : {}),
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
