/**
 * Reporting — revenue and margin reporting. Aggregates data from multiple sources.
 * GET: return the last generated report (or null if none).
 * POST action=generate: compute and save a fresh report.
 */

const OWNER = 'MoistPatch', REPO = 'Tensor-Works';

async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Reporting' },
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
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TensorWorks-Reporting', 'Content-Type': 'application/json' },
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

function round2(n) { return Math.round(n * 100) / 100; }
function round1(n) { return Math.round(n * 10) / 10; }

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return last generated report ────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/reporting.json', token, { lastGenerated: null, report: null });
    return jsonResponse(data);
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action !== 'generate') {
    return jsonResponse({ error: 'Unknown action. Use: generate' }, 400);
  }

  // ── action: generate ──────────────────────────────────────────────────────
  const [productsRes, outcomesRes, leadsRes, quotesRes, analyticsRes, funnelRes, reportingRes] = await Promise.all([
    loadJSON('data/products.json', token, []),
    loadJSON('data/outcomes.json', token, { orders: [], manual: [] }),
    loadJSON('data/leads.json', token, { leads: [] }),
    loadJSON('data/quotes.json', token, { quotes: [] }),
    loadJSON('data/analytics.json', token, { sessions: [] }),
    loadJSON('data/funnel.json', token, { events: [] }),
    loadJSON('data/reporting.json', token, { lastGenerated: null, report: null }),
  ]);

  const products = Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data?.products || []);
  const orders = outcomesRes.data?.orders || [];
  const leads = leadsRes.data?.leads || [];
  const quotes = quotesRes.data?.quotes || [];
  const sessions = analyticsRes.data?.sessions || [];
  const funnelEvents = funnelRes.data?.events || [];
  const reportingSha = reportingRes.sha;

  // ── Revenue by product (from outcomes.orders) ─────────────────────────────
  const revenueMap = {};
  for (const order of orders) {
    const sku = order.sku || 'unknown';
    if (!revenueMap[sku]) {
      revenueMap[sku] = { sku, title: order.title || order.productTitle || sku, unitsSold: 0, totalRevenueAUD: 0 };
    }
    revenueMap[sku].unitsSold += order.quantity || 1;
    revenueMap[sku].totalRevenueAUD += order.totalAUD || order.priceAUD || 0;
  }
  const revenueByProduct = Object.values(revenueMap)
    .map(p => ({
      ...p,
      totalRevenueAUD: round2(p.totalRevenueAUD),
      avgSalePriceAUD: p.unitsSold > 0 ? round2(p.totalRevenueAUD / p.unitsSold) : 0,
    }))
    .sort((a, b) => b.totalRevenueAUD - a.totalRevenueAUD)
    .slice(0, 20);

  // ── Gross margin by product (from products.json) ──────────────────────────
  const marginByProduct = products
    .filter(p => p.costExGst != null && p.priceIncGst != null)
    .map(p => {
      const costIncGst = round2(p.costExGst * 1.1);
      const marginAUD = round2(p.priceIncGst - costIncGst);
      const marginPct = round1(p.priceIncGst > 0 ? (marginAUD / p.priceIncGst) * 100 : 0);
      return {
        handle: p.handle || p.sku || '',
        title: p.title || '',
        priceIncGst: round2(p.priceIncGst),
        costIncGst,
        marginAUD,
        marginPct,
      };
    })
    .sort((a, b) => b.marginPct - a.marginPct)
    .slice(0, 20);

  // ── Quote pipeline ────────────────────────────────────────────────────────
  const byStatus = { draft: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0, expired: 0 };
  let totalValueAUD = 0;
  for (const q of quotes) {
    const s = (q.status || 'draft').toLowerCase();
    if (s in byStatus) byStatus[s]++;
    if (s !== 'rejected' && s !== 'expired') totalValueAUD += q.totalAUD || 0;
  }
  const acceptedPlusRejected = byStatus.accepted + byStatus.rejected;
  const acceptanceRate = acceptedPlusRejected > 0
    ? round1((byStatus.accepted / acceptedPlusRejected) * 100)
    : null;
  const quotePipeline = {
    total: quotes.length,
    byStatus,
    totalValueAUD: round2(totalValueAUD),
    acceptanceRate,
  };

  // ── Lead-to-quote conversion ──────────────────────────────────────────────
  const totalLeads = leads.length;
  const totalQuotes = quotes.length;
  const leadToQuote = {
    totalLeads,
    totalQuotes,
    conversionPct: totalLeads > 0 ? round1((totalQuotes / totalLeads) * 100) : null,
  };

  // ── Top customers by accepted quote value ─────────────────────────────────
  const customerMap = {};
  for (const q of quotes) {
    if ((q.status || '').toLowerCase() !== 'accepted') continue;
    const email = q.email || q.customerEmail || 'unknown';
    if (!customerMap[email]) {
      customerMap[email] = { email, company: q.company || q.customerCompany || '', totalQuotedAUD: 0, quoteCount: 0 };
    }
    customerMap[email].totalQuotedAUD += q.totalAUD || 0;
    customerMap[email].quoteCount++;
  }
  const topCustomers = Object.values(customerMap)
    .sort((a, b) => b.totalQuotedAUD - a.totalQuotedAUD)
    .slice(0, 10)
    .map(c => ({
      email: c.email.length > 3 ? c.email.slice(0, 3) + '***' : c.email,
      company: c.company,
      totalQuotedAUD: round2(c.totalQuotedAUD),
      quoteCount: c.quoteCount,
    }));

  // ── Session summary ───────────────────────────────────────────────────────
  const cutoff7 = Date.now() - 7 * 86400000;
  const cutoff30 = Date.now() - 30 * 86400000;
  const sessions7d = sessions.filter(s => new Date(s.timestamp).getTime() >= cutoff7).length;
  const sessions30d = sessions.filter(s => new Date(s.timestamp).getTime() >= cutoff30).length;

  // ── Funnel counts (last 30 days) ──────────────────────────────────────────
  const funnelCounts = { 'product-view': 0, 'add-to-cart': 0, 'quote-started': 0, 'checkout-started': 0, 'purchase': 0 };
  for (const e of funnelEvents) {
    if (new Date(e.timestamp).getTime() >= cutoff30 && e.type in funnelCounts) {
      funnelCounts[e.type]++;
    }
  }

  // ── Assemble and save report ──────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    revenueByProduct,
    marginByProduct,
    quotePipeline,
    leadToQuote,
    topCustomers,
    sessionSummary: { sessions7d, sessions30d },
    funnel: funnelCounts,
  };

  const reportingPayload = { lastGenerated: report.generatedAt, report };
  await ghPut('data/reporting.json', JSON.stringify(reportingPayload, null, 2), reportingSha, 'Reporting: generate report', token);

  return jsonResponse({ generated: true, report });
}
