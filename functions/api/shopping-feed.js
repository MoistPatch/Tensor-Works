/**
 * Shopping Feed — Google Merchant Center RSS 2.0 XML feed.
 * GET: returns a valid Google Shopping feed from data/products.json.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks' },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}
async function loadJSON(path, token, fallback = null) {
  try { const f = await ghGet(path, token); return { data: JSON.parse(atob(f.content.replace(/\s/g, ''))), sha: f.sha }; }
  catch (_) { return { data: fallback, sha: null }; }
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
function xmlResponse(xml) {
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  const siteUrl = (env.SITE_URL || 'https://tensorworks.online').replace(/\/$/, '');

  const { data: products } = await loadJSON('data/products.json', token, []);
  if (!Array.isArray(products)) return jsonResponse({ error: 'products.json is not an array' }, 500);

  // Filter: priceIncGst must be a number > 0, status must not be 'draft' or 'hidden'
  const eligible = products.filter(p =>
    typeof p.priceIncGst === 'number' &&
    p.priceIncGst > 0 &&
    p.status !== 'draft' &&
    p.status !== 'hidden'
  );

  const items = eligible.map(p => {
    const price = p.priceIncGst.toFixed(2) + ' AUD';
    const availability = p.inStock === false ? 'out of stock' : 'in stock';
    const description = escapeXml(p.description || p.title || p.name || '');
    const title = escapeXml(p.title || p.name || p.handle || '');
    const handle = escapeXml(p.handle || p.id || '');
    const category = escapeXml(p.category || '');
    const imageTag = p.image ? `\n      <g:image_link>${escapeXml(p.image)}</g:image_link>` : '';

    return `    <item>
      <g:id>${handle}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${siteUrl}/products/${handle}</g:link>${imageTag}
      <g:price>${escapeXml(price)}</g:price>
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Tensor Works</g:brand>
      <g:product_type>${category}</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Tensor Works</title>
    <link>${siteUrl}</link>
    <description>AI Hardware and GPU Solutions</description>
${items}
  </channel>
</rss>`;

  return xmlResponse(xml);
}
