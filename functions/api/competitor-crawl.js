const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-opus-4-5';

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

async function callClaude(apiKey, systemPrompt, userContent) {
  const r = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error?.message || 'Anthropic API failed: ' + r.status);
  }
  const data = await r.json();
  return data.content[0].text;
}

function parseJsonSafe(text) {
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function crawlSite(site, products, apiKey) {
  const result = {
    id: site.id,
    name: site.name,
    status: 'ok',
    productCount: 0,
    matched: 0,
    error: null,
  };

  let html = '';
  try {
    const pageRes = await fetch(site.catalogueUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
    });
    if (!pageRes.ok) {
      result.status = 'blocked';
      result.error = 'HTTP ' + pageRes.status;
      return result;
    }
    html = await pageRes.text();
  } catch (e) {
    result.status = 'blocked';
    result.error = e.message;
    return result;
  }

  const truncatedHtml = html.slice(0, 15000);

  const extractSystemPrompt = 'You are a web scraping specialist. Extract product listings from this HTML. Return JSON array of products found: [{title, price, url, availability}]. Price should be a number (AUD, ex-GST if possible). Return [] if no products found. Return ONLY valid JSON, no commentary.';

  let extractedProducts = [];
  try {
    const extractText = await callClaude(apiKey, extractSystemPrompt, truncatedHtml);
    extractedProducts = parseJsonSafe(extractText) || [];
    if (!Array.isArray(extractedProducts)) extractedProducts = [];
  } catch (e) {
    result.error = 'Extraction failed: ' + e.message;
  }

  result.productCount = extractedProducts.length;

  if (extractedProducts.length === 0) {
    return result;
  }

  const matchSystemPrompt = 'Match these competitor products to our catalogue. Return JSON: [{ourHandle, competitorTitle, competitorPrice, competitorUrl, confidence}]. Only include matches with confidence > 0.7. Return ONLY valid JSON.';
  const matchUserContent = 'Competitor products:\n' + JSON.stringify(extractedProducts, null, 2) +
    '\n\nOur catalogue:\n' + JSON.stringify(products.map(function(p) { return { handle: p.handle, title: p.title, sku: p.sku, category: p.category }; }), null, 2);

  let matches = [];
  try {
    const matchText = await callClaude(apiKey, matchSystemPrompt, matchUserContent);
    matches = parseJsonSafe(matchText) || [];
    if (!Array.isArray(matches)) matches = [];
  } catch (e) {
    result.error = (result.error ? result.error + '; ' : '') + 'Matching failed: ' + e.message;
  }

  result.matched = matches.length;
  result.matchData = matches.map(function(m) {
    return {
      matchedHandle: m.ourHandle,
      competitorTitle: m.competitorTitle,
      competitorPrice: m.competitorPrice,
      competitorUrl: m.competitorUrl || site.catalogueUrl,
      crawledAt: new Date().toISOString(),
    };
  });

  return result;
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

  const syncSecret = env.SYNC_SECRET;
  if (syncSecret) {
    const provided = request.headers.get('X-Sync-Secret');
    if (provided !== syncSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  if (request.method === 'GET') {
    try {
      const pricesFile = await ghGet('data/competitor-prices.json', token);
      const prices = JSON.parse(atob(pricesFile.content.replace(/\n/g, '')));
      return jsonResponse(prices);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    try {
      const [sitesFile, pricesFile, productsFile] = await Promise.all([
        ghGet('data/competitor-sites.json', token),
        ghGet('data/competitor-prices.json', token),
        ghGet('data/products.json', token),
      ]);

      let sites = JSON.parse(atob(sitesFile.content.replace(/\n/g, '')));
      let prices = JSON.parse(atob(pricesFile.content.replace(/\n/g, '')));
      const products = JSON.parse(atob(productsFile.content.replace(/\n/g, '')));

      const targetSites = body.id ? sites.filter(function(s) { return s.id === body.id; }) : sites;

      if (targetSites.length === 0) {
        return jsonResponse({ error: 'No competitor sites found' }, 404);
      }

      const summary = [];
      for (const site of targetSites) {
        const crawlResult = await crawlSite(site, products, apiKey);
        summary.push({ id: crawlResult.id, name: crawlResult.name, status: crawlResult.status, productCount: crawlResult.productCount, matched: crawlResult.matched });

        const siteIdx = sites.findIndex(function(s) { return s.id === site.id; });
        if (siteIdx !== -1) {
          sites[siteIdx].lastCrawled = new Date().toISOString();
          sites[siteIdx].lastStatus = crawlResult.status;
          sites[siteIdx].productCount = crawlResult.productCount;
        }

        if (crawlResult.matchData && crawlResult.matchData.length > 0) {
          prices[site.id] = crawlResult.matchData;
        }
      }

      const updatedSitesFile = await ghGet('data/competitor-sites.json', token);
      const updatedPricesFile = await ghGet('data/competitor-prices.json', token);

      await Promise.all([
        ghPut('data/competitor-sites.json', JSON.stringify(sites, null, 2), updatedSitesFile.sha, 'Update competitor crawl results', token),
        ghPut('data/competitor-prices.json', JSON.stringify(prices, null, 2), updatedPricesFile.sha, 'Update competitor prices from crawl', token),
      ]);

      return jsonResponse({ success: true, crawled: targetSites.length, summary });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
