/**
 * Klaviyo — event tracking and profile sync integration.
 * GET: configuration status. POST actions: track-event, sync-profile.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  // ── GET: configuration status ─────────────────────────────────────────────
  if (request.method === 'GET') {
    return jsonResponse({ configured: !!env.KLAVIYO_API_KEY, docs: 'POST with action=track-event or action=sync-profile' });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // ── action: track-event ───────────────────────────────────────────────────
  if (action === 'track-event') {
    if (!env.KLAVIYO_API_KEY) {
      return jsonResponse({ skipped: true, reason: 'KLAVIYO_API_KEY not configured' });
    }

    const { email, eventName, properties = {} } = body;
    if (!email || !eventName) return jsonResponse({ error: 'email and eventName required' }, 400);

    try {
      const r = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_API_KEY}`,
          'revision': '2023-10-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              profile: { data: { type: 'profile', attributes: { email } } },
              metric: { data: { type: 'metric', attributes: { name: eventName } } },
              properties,
            },
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return jsonResponse({ tracked: false, error: err.errors?.[0]?.detail || 'Klaviyo API error: ' + r.status });
      }

      return jsonResponse({ tracked: true, event: eventName });
    } catch (e) {
      return jsonResponse({ tracked: false, error: e.message });
    }
  }

  // ── action: sync-profile ──────────────────────────────────────────────────
  if (action === 'sync-profile') {
    if (!env.KLAVIYO_API_KEY) {
      return jsonResponse({ skipped: true, reason: 'KLAVIYO_API_KEY not configured' });
    }

    const { email, firstName, lastName, company, phone, tierId, properties = {} } = body;
    if (!email) return jsonResponse({ error: 'email required' }, 400);

    const attributes = { email };
    if (firstName != null) attributes.first_name = firstName;
    if (lastName != null) attributes.last_name = lastName;
    if (company != null) attributes.organization = company;
    if (phone != null) attributes.phone_number = phone;

    // Merge tierId and any extra properties into properties block
    const customProps = { ...properties };
    if (tierId != null) customProps.tierId = tierId;
    if (Object.keys(customProps).length > 0) attributes.properties = customProps;

    try {
      const r = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_API_KEY}`,
          'revision': '2023-10-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes,
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return jsonResponse({ synced: false, error: err.errors?.[0]?.detail || 'Klaviyo API error: ' + r.status });
      }

      return jsonResponse({ synced: true });
    } catch (e) {
      return jsonResponse({ synced: false, error: e.message });
    }
  }

  return jsonResponse({ error: 'Unknown action. Use: track-event | sync-profile' }, 400);
}
