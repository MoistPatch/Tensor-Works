/**
 * Lead — captures enquiry/lead submissions from the website contact form.
 * GET: returns lead summary (totals, top products, recent leads with masked emails).
 * POST: records a new lead and optionally sends a notification email via Resend.
 */

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

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return lead summary ──────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON('data/leads.json', token, { leads: [] });
    const leads = data.leads || [];

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const leadsThisWeek = leads.filter(l => new Date(l.submittedAt).getTime() >= weekAgo).length;

    // Top products by enquiry count
    const productCounts = {};
    for (const l of leads) {
      if (l.productHandle) productCounts[l.productHandle] = (productCounts[l.productHandle] || 0) + 1;
    }
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([handle, count]) => ({ handle, count }));

    // Recent 10 leads with masked email
    const recentLeads = leads.slice(0, 10).map(l => ({
      ...l,
      email: l.email ? l.email.slice(0, 3) + '***' : '',
    }));

    return jsonResponse({ totalLeads: leads.length, leadsThisWeek, topProducts, recentLeads });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── POST: capture a new lead ──────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));

  const name = sanitize(body.name);
  const email = sanitize(body.email);
  const company = sanitize(body.company);
  let message = sanitize(body.message);
  const productHandle = sanitize(body.productHandle);
  const budget = sanitize(body.budget);

  if (!name || (!email && !message)) {
    return jsonResponse({ error: 'name and either email or message are required' }, 400);
  }

  // Truncate message to 1000 chars
  if (message.length > 1000) message = message.slice(0, 1000);

  const lead = {
    id: Date.now(),
    name,
    email,
    company,
    message,
    productHandle,
    budget,
    submittedAt: new Date().toISOString(),
    source: 'website',
  };

  const { data, sha } = await loadJSON('data/leads.json', token, { leads: [] });
  const leads = data.leads || [];
  leads.unshift(lead);
  if (leads.length > 500) leads.splice(500);
  data.leads = leads;

  await ghPut('data/leads.json', JSON.stringify(data, null, 2), sha, `Lead: new enquiry from ${name}`, token);

  // Optional: send notification email via Resend
  if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
    const emailBody = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Product: ${productHandle}`,
      `Budget: ${budget}`,
      `Message: ${message}`,
    ].join('\n');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'leads@tensorworks.com.au',
        to: env.ALERT_EMAIL,
        subject: 'New Enquiry: ' + name,
        text: emailBody,
      }),
    }).catch(() => {}); // non-blocking — don't fail the request if email fails
  }

  return jsonResponse({ received: true, id: lead.id });
}
