/**
 * Alert — unified alert dispatcher. Sends high-urgency alerts via Resend email and/or Slack.
 * GET: returns data/alert-log.json (last 50 alerts).
 * POST: dispatches alert to configured channels and appends to log.
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

const VALID_TYPES = ['anomaly', 'forex', 'competitor', 'cost-change', 'experiment'];
const LOG_PATH = 'data/alert-log.json';
const LOG_FALLBACK = { alerts: [] };

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT not configured' }, 500);

  // ── GET: return alert log ─────────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data } = await loadJSON(LOG_PATH, token, LOG_FALLBACK);
    return jsonResponse(data);
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── POST: dispatch alert ──────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const { type, title, message, urgency, data } = body;

  if (!type || !message) return jsonResponse({ error: 'type and message are required' }, 400);

  const alert = {
    id: Date.now(),
    type,
    title: title || type,
    message,
    urgency: urgency || 'medium',
    data: data || {},
    sentAt: new Date().toISOString(),
    channels: [],
  };

  // ── Try Resend email ──────────────────────────────────────────────────────
  if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'alerts@tensorworks.online',
          to: [env.ALERT_EMAIL],
          subject: '[TensorWorks] ' + alert.title,
          html: '<h2>' + alert.title + '</h2><p>' + alert.message + '</p><pre>' + JSON.stringify(alert.data, null, 2) + '</pre>',
        }),
      });
      if (emailRes.ok) alert.channels.push('email');
    } catch (_) { /* email failure is non-fatal */ }
  }

  // ── Try Slack webhook ─────────────────────────────────────────────────────
  if (env.SLACK_WEBHOOK_URL) {
    try {
      const slackRes = await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '*[TensorWorks]* ' + alert.title + '\n' + alert.message,
          attachments: [{ text: JSON.stringify(alert.data, null, 2) }],
        }),
      });
      if (slackRes.ok) alert.channels.push('slack');
    } catch (_) { /* slack failure is non-fatal */ }
  }

  // ── Append to alert log ───────────────────────────────────────────────────
  const { data: log, sha } = await loadJSON(LOG_PATH, token, LOG_FALLBACK);
  log.alerts = [alert, ...(log.alerts || [])].slice(0, 50);
  await ghPut(LOG_PATH, JSON.stringify(log, null, 2), sha, 'Alert: ' + alert.type + ' — ' + alert.title, token);

  return jsonResponse({ dispatched: true, channels: alert.channels, id: alert.id });
}
