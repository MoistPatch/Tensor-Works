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

async function fetchHTML(siteUrl, scrapingBeeKey) {
  if (scrapingBeeKey) {
    try {
      const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(siteUrl)}&render_js=true`;
      const r = await fetch(sbUrl);
      if (r.ok) return await r.text();
    } catch (_) {}
  }
  try {
    const r = await fetch(siteUrl, { headers: { 'User-Agent': 'Mozilla/5.0 TensorWorks' } });
    if (r.ok) return await r.text();
  } catch (_) {}
  return null;
}

async function claudeExtract(html, anthropicKey) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      system: 'You are a product data extractor. Extract all products from this HTML. Return ONLY valid JSON array: [{name, price, currency, url, inStock}] where inStock is true if clearly in stock, false if clearly out of stock, null if unknown.',
      messages: [{ role: 'user', content: html.slice(0, 15000) }],
    }),
  });
  if (!r.ok) throw new Error('Claude extract failed: ' + r.status);
  const j = await r.json();
  const text = j.content?.[0]?.text || '[]';
  try { return JSON.parse(text); } catch (_) { return []; }
}

async function claudeMatch(extracted, catalogue, anthropicKey) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      system: 'Match competitor products to our catalogue. Return ONLY valid JSON array: [{handle: ourProductHandle, competitorName, competitorPrice, matchConfidence}] Only include confident matches (>0.6).',
      messages: [{ role: 'user', content: JSON.stringify({ extracted, catalogue }) }],
    }),
  });
  if (!r.ok) throw new Error('Claude match failed: ' + r.status);
  const j = await r.json();
  const text = j.content?.[0]?.text || '[]';
  try { return JSON.parse(text); } catch (_) { return []; }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const token = env.GITHUB_PAT;
  const scrapingBeeKey = env.SCRAPINGBEE_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  const [sitesResult, productsResult, pricesResult] = await Promise.all([
    loadJSON('data/competitor-sites.json', token, { sites: [] }),
    loadJSON('data/products.json', token, []),
    loadJSON('data/competitor-prices.json', token, { lastCrawled: null, products: [] }),
  ]);

  const sites = sitesResult.data.sites;
  const catalogue = (Array.isArray(productsResult.data) ? productsResult.data : []).map(p => ({ handle: p.handle, name: p.name, priceIncGst: p.priceIncGst }));
  const pricesData = pricesResult.data;
  const pricesSha = pricesResult.sha;
  const sitesSha = sitesResult.sha;

  const sitesToCrawl = sites.slice(0, 3);
  const errors = [];
  let matchesFound = 0;
  const crawledAt = new Date().toISOString();

  const productsMap = {};
  for (const p of pricesData.products) {
    productsMap[p.handle] = p;
  }

  for (const site of sitesToCrawl) {
    try {
      const html = await fetchHTML(site.url, scrapingBeeKey);
      if (!html) {
        errors.push({ site: site.url, error: 'blocked' });
        continue;
      }

      const extracted = await claudeExtract(html, anthropicKey);
      const matches = await claudeMatch(extracted, catalogue, anthropicKey);

      const stockMap = {};
      for (const e of extracted) {
        if (e.name) stockMap[e.name.toLowerCase()] = e.inStock;
      }

      for (const match of matches) {
        const { handle, competitorName, competitorPrice, matchConfidence } = match;
        if (!handle || matchConfidence <= 0.6) continue;
        if (!productsMap[handle]) {
          const ourProduct = catalogue.find(p => p.handle === handle);
          productsMap[handle] = { handle, ourPrice: ourProduct?.priceIncGst ?? null, competitors: [] };
        }
        const entry = productsMap[handle];
        const idx = entry.competitors.findIndex(c => c.site === site.url);
        const inStock = stockMap[competitorName?.toLowerCase()] ?? null;
        const competitorEntry = { site: site.url, price: competitorPrice, url: site.url, inStock, crawledAt };
        if (idx >= 0) { entry.competitors[idx] = competitorEntry; } else { entry.competitors.push(competitorEntry); }
        matchesFound++;
      }

      site.lastCrawledAt = crawledAt;
    } catch (err) {
      errors.push({ site: site.url, error: err.message });
    }
  }

  pricesData.products = Object.values(productsMap);
  pricesData.lastCrawled = crawledAt;

  const stockOpportunities = [];
  for (const prod of Object.values(productsMap)) {
    const oosCompetitors = (prod.competitors || []).filter(c => c.inStock === false && c.crawledAt === crawledAt);
    if (oosCompetitors.length > 0) {
      stockOpportunities.push({ handle: prod.handle, ourPrice: prod.ourPrice, competitorsOOS: oosCompetitors.map(c => c.site) });
    }
  }

  const { data: stockOppData, sha: stockOppSha } = await loadJSON('data/stock-opportunities.json', token, { opportunities: [], lastChecked: null });
  stockOppData.lastChecked = crawledAt;
  stockOppData.opportunities = [...stockOpportunities, ...stockOppData.opportunities].slice(0, 50);

  await Promise.all([
    ghPut('data/competitor-prices.json', JSON.stringify(pricesData, null, 2), pricesSha, 'Update competitor prices', token),
    ghPut('data/competitor-sites.json', JSON.stringify({ sites }, null, 2), sitesSha, 'Update competitor site crawl timestamps', token),
    ghPut('data/stock-opportunities.json', JSON.stringify(stockOppData, null, 2), stockOppSha, 'Update stock opportunities', token),
  ]);

  return jsonResponse({ success: true, sitesCrawled: sitesToCrawl.length - errors.length, matchesFound, stockOpportunities: stockOpportunities.length, errors });
}
