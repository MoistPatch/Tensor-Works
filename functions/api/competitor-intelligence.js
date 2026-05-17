/**
 * Competitor Intelligence — Apify-powered scraping with GitHub-backed cache.
 * GET  ?sku=X          → cached data for SKU (or all SKU summaries)
 * POST action=run      → trigger Apify for specific SKU + URLs
 * POST action=run-all  → run Apify across all competitor-sites.json
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';
const CACHE_FILE = 'data/competitor-intelligence.json';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

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

// Generic Apify page function — works on most e-commerce product/search pages
const SCRAPER_PAGE_FUNCTION = `async function pageFunction(context) {
  const $ = context.$;
  const url = context.request.url;
  const name = $('h1').first().text().trim() || $('[itemprop="name"]').first().text().trim();

  // Price extraction — try structured data first, then common selectors
  let price = null;
  const priceAttr = $('[itemprop="price"]').first().attr('content');
  if (priceAttr) {
    price = parseFloat(priceAttr);
  } else {
    const selectors = ['.price', '[class*="price"]', '[class*="Price"]', '.product-price', '[data-price]'];
    for (const sel of selectors) {
      const t = $(sel).first().text().replace(/[,$\\s]/g, '');
      const m = t.match(/[0-9]+\\.?[0-9]*/);
      if (m) { const v = parseFloat(m[0]); if (v > 50) { price = v; break; } }
    }
  }

  // Stock status
  const stockEls = $('[class*="stock"], [class*="availability"], [class*="inventory"], [class*="Status"]');
  const stockText = stockEls.first().text().toLowerCase();
  const inStock = /in[\\s-]?stock|add to cart|available/.test(stockText) ? true
                : /out[\\s-]?of[\\s-]?stock|unavailable|sold out/.test(stockText) ? false : null;

  // Bundle detection
  const bundleHints = $('[class*="bundle"], [class*="Bundle"], [class*="kit"]').length > 0;

  // Promotion/campaign detection
  const promoText = $('[class*="promo"], [class*="sale"], [class*="campaign"], [class*="discount"], .badge, .tag').first().text().trim();

  return { url, name, price, currency: 'AUD', inStock, bundleHints, promoText: promoText.slice(0, 100) };
}`;

async function runApifyActor(apiKey, actorId, input) {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${apiKey}&timeout=55&clean=true&format=json`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(57000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error?.message || `Apify HTTP ${r.status}`);
  }
  return r.json();
}

function normalizeItem(item, competitorName) {
  return {
    competitor: competitorName,
    productName: item.name || '',
    price: item.price || null,
    currency: item.currency || 'AUD',
    stockStatus: item.inStock === true ? 'in_stock' : item.inStock === false ? 'out_of_stock' : 'unknown',
    bundleDeals: [],
    activeCampaigns: item.promoText ? [{ name: item.promoText }] : [],
    url: item.url || '',
    lastUpdated: new Date().toISOString(),
  };
}

function computePriceTrend(existingPrice, newPrice) {
  if (!existingPrice || !newPrice) return 'stable';
  const delta = (newPrice - existingPrice) / existingPrice;
  if (delta > 0.02) return 'rising';
  if (delta < -0.02) return 'falling';
  return 'stable';
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }});
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  const apifyKey = env.APIFY_API_KEY;
  const actorId = env.APIFY_ACTOR_ID || 'apify~cheerio-scraper';

  if (request.method === 'GET') {
    const sku = new URL(request.url).searchParams.get('sku');
    const { data } = await loadJSON(CACHE_FILE, token, { skus: {}, lastRun: null });

    if (sku) {
      const skuData = data.skus?.[sku];
      if (!skuData) return jsonResponse({ sku, competitors: [], priceTrend: [], cached: false });
      const ageMs = skuData.lastFetched ? Date.now() - new Date(skuData.lastFetched).getTime() : Infinity;
      return jsonResponse({ sku, ...skuData, fresh: ageMs < CACHE_TTL_MS, ageHours: Math.round(ageMs / 360000) / 10 });
    }

    const summary = Object.entries(data.skus || {}).map(([sku, d]) => {
      const prices = (d.competitors || []).filter(c => c.price).map(c => c.price);
      return {
        sku,
        competitorCount: d.competitors?.length || 0,
        lastFetched: d.lastFetched,
        lowestPrice: prices.length ? Math.min(...prices) : null,
        highestPrice: prices.length ? Math.max(...prices) : null,
      };
    });
    return jsonResponse({ skus: summary, lastRun: data.lastRun, apifyConfigured: !!apifyKey });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === 'run') {
    const { sku, urls } = body;
    if (!sku || !Array.isArray(urls) || !urls.length) {
      return jsonResponse({ error: 'sku and urls[] required' }, 400);
    }
    if (!apifyKey) {
      return jsonResponse({ error: 'APIFY_API_KEY not configured. Add it to Cloudflare Pages environment variables.' }, 500);
    }

    const results = [];
    for (const { competitor, url: targetUrl } of urls.slice(0, 5)) {
      try {
        const items = await runApifyActor(apifyKey, actorId, {
          startUrls: [{ url: targetUrl }],
          pageFunction: SCRAPER_PAGE_FUNCTION,
          maxCrawlingDepth: 0,
          maxPagesPerCrawl: 3,
          proxyConfiguration: { useApifyProxy: true },
        });
        results.push(...items.map(item => normalizeItem({ ...item, url: item.url || targetUrl }, competitor)));
      } catch (e) {
        results.push({ competitor, url: targetUrl, error: e.message, lastUpdated: new Date().toISOString() });
      }
    }

    const { data: cache, sha: cacheSha } = await loadJSON(CACHE_FILE, token, { skus: {}, lastRun: null });
    cache.skus = cache.skus || {};
    const existing = cache.skus[sku] || { competitors: [], priceTrend: [] };
    existing.priceTrend = existing.priceTrend || [];

    for (const result of results) {
      if (result.error) continue;
      const idx = existing.competitors.findIndex(c => c.competitor === result.competitor);
      if (idx >= 0) {
        const oldPrice = existing.competitors[idx].price;
        if (oldPrice && result.price && oldPrice !== result.price) {
          existing.priceTrend.push({
            competitor: result.competitor,
            oldPrice,
            newPrice: result.price,
            trend: computePriceTrend(oldPrice, result.price),
            changedAt: new Date().toISOString(),
          });
          if (existing.priceTrend.length > 100) existing.priceTrend = existing.priceTrend.slice(-100);
        }
        existing.competitors[idx] = result;
      } else {
        existing.competitors.push(result);
      }
    }

    existing.lastFetched = new Date().toISOString();
    cache.skus[sku] = existing;
    cache.lastRun = new Date().toISOString();

    await ghPut(CACHE_FILE, JSON.stringify(cache, null, 2), cacheSha,
      `Competitor intelligence: ${sku} — ${results.length} results`, token);

    return jsonResponse({ success: true, sku, results, count: results.length });
  }

  if (action === 'run-all') {
    if (!apifyKey) return jsonResponse({ error: 'APIFY_API_KEY not configured' }, 500);
    const { data: sites } = await loadJSON('data/competitor-sites.json', token, []);
    const startUrls = (sites || []).slice(0, 8).map(s => ({ url: s.url }));
    if (!startUrls.length) return jsonResponse({ error: 'No competitor sites configured in data/competitor-sites.json' }, 400);

    try {
      const items = await runApifyActor(apifyKey, actorId, {
        startUrls,
        pageFunction: SCRAPER_PAGE_FUNCTION,
        maxCrawlingDepth: 1,
        maxPagesPerCrawl: 5,
        proxyConfiguration: { useApifyProxy: true },
      });
      const { data: cache, sha: cacheSha } = await loadJSON(CACHE_FILE, token, { skus: {}, lastRun: null });
      cache.rawResults = items.slice(0, 200);
      cache.lastRun = new Date().toISOString();
      await ghPut(CACHE_FILE, JSON.stringify(cache, null, 2), cacheSha,
        `Competitor intelligence run-all: ${items.length} items`, token);
      return jsonResponse({ success: true, itemsCollected: items.length });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // Manual cache update (no Apify — just store provided data)
  if (action === 'update') {
    const { sku, competitors } = body;
    if (!sku || !Array.isArray(competitors)) return jsonResponse({ error: 'sku and competitors[] required' }, 400);
    const { data: cache, sha: cacheSha } = await loadJSON(CACHE_FILE, token, { skus: {}, lastRun: null });
    cache.skus = cache.skus || {};
    cache.skus[sku] = { competitors, priceTrend: cache.skus[sku]?.priceTrend || [], lastFetched: new Date().toISOString() };
    await ghPut(CACHE_FILE, JSON.stringify(cache, null, 2), cacheSha, `Competitor intelligence manual update: ${sku}`, token);
    return jsonResponse({ success: true, sku });
  }

  return jsonResponse({ error: 'Unknown action. Use: run | run-all | update' }, 400);
}
