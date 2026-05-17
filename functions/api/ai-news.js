const RSS_URL = 'https://news.google.com/rss/search?q=artificial+intelligence+LLM+GPU&hl=en-AU&gl=AU&ceid=AU:en';
const MAX_ITEMS = 20;

function parseRSS(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < MAX_ITEMS) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link  = extractTag(block, 'link');
    const src   = extractTag(block, 'source');
    const pub   = extractTag(block, 'pubDate');
    if (title) items.push({ title, url: link, source: src, pubDate: pub });
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const cm = cdataRe.exec(xml);
  if (cm) return cm[1].trim();
  const pm = plainRe.exec(xml);
  return pm ? pm[1].replace(/<[^>]+>/g, '').trim() : '';
}

function jsonResponse(data, status = 200, cacheSecs = 1800) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=${cacheSecs}, s-maxage=${cacheSecs}`,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  }

  try {
    const r = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'TensorWorks/1.0' },
      cf: { cacheTtl: 1800, cacheEverything: true },
    });
    if (!r.ok) throw new Error('RSS fetch failed: ' + r.status);
    const xml = await r.text();
    const articles = parseRSS(xml);
    return jsonResponse({ articles, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ articles: [], error: err.message }, 200);
  }
}
