/**
 * Cloudflare Analytics — pulls real traffic data from Cloudflare's GraphQL API.
 * Requires CF_API_TOKEN (Zone:Read + Analytics:Read) and CF_ZONE_ID env vars.
 * GET: returns pageviews, visitors, countries, referrers, devices, performance for last N days.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const GQL = 'https://api.cloudflare.com/client/v4/graphql';

function gqlHeaders(token) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function dateStr(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

async function queryZoneAnalytics(token, zoneId, days) {
  const since = dateStr(days);
  const until = dateStr(0);

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequestsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 1
          orderBy: [date_DESC]
        ) {
          sum { requests pageViews cachedRequests bytes }
          uniq { uniques }
        }
        topCountries: httpRequestsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_requests_DESC]
        ) {
          count
          dimensions { clientCountryName }
          sum { requests }
        }
        topPaths: httpRequestsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}", clientRequestPath_like: "%" }
          limit: 10
          orderBy: [sum_requests_DESC]
        ) {
          dimensions { clientRequestPath }
          sum { requests pageViews }
        }
        topReferers: httpRequestsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_requests_DESC]
        ) {
          dimensions { clientRefererHost }
          sum { requests }
        }
        httpStatusBreakdown: httpRequestsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_requests_DESC]
        ) {
          dimensions { edgeResponseStatus }
          sum { requests }
        }
        dailyTrend: httpRequestsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: ${days + 1}
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum { requests pageViews }
          uniq { uniques }
        }
      }
    }
  }`;

  const r = await fetch(GQL, {
    method: 'POST',
    headers: gqlHeaders(token),
    body: JSON.stringify({ query }),
  });

  if (!r.ok) throw new Error('Cloudflare GraphQL HTTP ' + r.status);
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors[0].message);
  return j.data?.viewer?.zones?.[0];
}

async function queryWebAnalytics(token, zoneId, days) {
  const since = dateStr(days);
  const until = dateStr(0);

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 1
        ) {
          sum { visits pageViews }
          avg { sampleInterval }
        }
        topRumPages: rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_pageViews_DESC]
        ) {
          dimensions { requestPath }
          sum { pageViews visits }
        }
        topRumReferers: rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_visits_DESC]
        ) {
          dimensions { refererHost }
          sum { visits }
        }
        rumDevices: rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_visits_DESC]
        ) {
          dimensions { deviceType }
          sum { visits }
        }
        rumBrowsers: rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_visits_DESC]
        ) {
          dimensions { userAgentBrowser }
          sum { visits }
        }
        rumCountries: rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: 10
          orderBy: [sum_visits_DESC]
        ) {
          dimensions { countryName }
          sum { visits }
        }
        rumDailyTrend: rumPageloadEventsAdaptiveGroups(
          filter: { date_geq: "${since}", date_leq: "${until}" }
          limit: ${days + 1}
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum { visits pageViews }
        }
      }
    }
  }`;

  const r = await fetch(GQL, {
    method: 'POST',
    headers: gqlHeaders(token),
    body: JSON.stringify({ query }),
  });

  if (!r.ok) throw new Error('Cloudflare RUM GraphQL HTTP ' + r.status);
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors[0].message);
  return j.data?.viewer?.zones?.[0];
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const token = env.CF_API_TOKEN;
  const zoneId = env.CF_ZONE_ID;

  if (!token || !zoneId) {
    return jsonResponse({
      configured: false,
      error: 'CF_API_TOKEN and CF_ZONE_ID env vars required',
      hint: 'Create an API token at dash.cloudflare.com → My Profile → API Tokens with Zone:Read + Analytics:Read permissions. Find Zone ID on your domain\'s Overview page.',
    });
  }

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '7', 10), 30);

  const results = { configured: true, days, generatedAt: new Date().toISOString() };

  // Run both queries concurrently — Web Analytics may fail if beacon not installed
  const [zoneResult, rumResult] = await Promise.allSettled([
    queryZoneAnalytics(token, zoneId, days),
    queryWebAnalytics(token, zoneId, days),
  ]);

  // Zone-level (CDN) analytics
  if (zoneResult.status === 'fulfilled' && zoneResult.value) {
    const z = zoneResult.value;
    const totals = z.httpRequestsAdaptiveGroups?.[0];

    results.zone = {
      requests: totals?.sum?.requests ?? 0,
      pageViews: totals?.sum?.pageViews ?? 0,
      uniqueVisitors: totals?.uniq?.uniques ?? 0,
      cachedRequests: totals?.sum?.cachedRequests ?? 0,
      bytesServed: totals?.sum?.bytes ?? 0,
      cacheHitRate: totals?.sum?.requests > 0
        ? Math.round((totals.sum.cachedRequests / totals.sum.requests) * 1000) / 10
        : null,
      topCountries: (z.topCountries || [])
        .filter(g => g.dimensions?.clientCountryName)
        .map(g => ({ country: g.dimensions.clientCountryName, requests: g.sum.requests })),
      topPaths: (z.topPaths || [])
        .filter(g => g.dimensions?.clientRequestPath)
        .map(g => ({ path: g.dimensions.clientRequestPath, requests: g.sum.requests, pageViews: g.sum.pageViews })),
      topReferers: (z.topReferers || [])
        .filter(g => g.dimensions?.clientRefererHost && g.dimensions.clientRefererHost !== '')
        .map(g => ({ host: g.dimensions.clientRefererHost, requests: g.sum.requests })),
      statusBreakdown: (z.httpStatusBreakdown || [])
        .filter(g => g.dimensions?.edgeResponseStatus)
        .map(g => ({ status: g.dimensions.edgeResponseStatus, requests: g.sum.requests })),
      dailyTrend: (z.dailyTrend || [])
        .filter(g => g.dimensions?.date)
        .map(g => ({ date: g.dimensions.date, requests: g.sum.requests, pageViews: g.sum.pageViews, uniques: g.uniq?.uniques ?? 0 })),
    };
  } else {
    results.zoneError = zoneResult.reason?.message || 'Zone analytics unavailable';
  }

  // Web Analytics (RUM beacon)
  if (rumResult.status === 'fulfilled' && rumResult.value) {
    const r = rumResult.value;
    const totals = r.rumPageloadEventsAdaptiveGroups?.[0];

    results.rum = {
      visits: totals?.sum?.visits ?? 0,
      pageViews: totals?.sum?.pageViews ?? 0,
      topPages: (r.topRumPages || [])
        .filter(g => g.dimensions?.requestPath)
        .map(g => ({ path: g.dimensions.requestPath, pageViews: g.sum.pageViews, visits: g.sum.visits })),
      topReferers: (r.topRumReferers || [])
        .filter(g => g.dimensions?.refererHost && g.dimensions.refererHost !== '')
        .map(g => ({ host: g.dimensions.refererHost, visits: g.sum.visits })),
      devices: (r.rumDevices || [])
        .filter(g => g.dimensions?.deviceType)
        .map(g => ({ type: g.dimensions.deviceType, visits: g.sum.visits })),
      browsers: (r.rumBrowsers || [])
        .filter(g => g.dimensions?.userAgentBrowser)
        .map(g => ({ browser: g.dimensions.userAgentBrowser, visits: g.sum.visits })),
      countries: (r.rumCountries || [])
        .filter(g => g.dimensions?.countryName)
        .map(g => ({ country: g.dimensions.countryName, visits: g.sum.visits })),
      dailyTrend: (r.rumDailyTrend || [])
        .filter(g => g.dimensions?.date)
        .map(g => ({ date: g.dimensions.date, visits: g.sum.visits, pageViews: g.sum.pageViews })),
    };
  } else {
    results.rumError = rumResult.reason?.message || 'Web Analytics (RUM) unavailable — beacon may not be installed';
  }

  return jsonResponse(results);
}
