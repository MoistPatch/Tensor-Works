const SHOPIFY_DOMAIN = 'ituspq-hc.myshopify.com';
const SHOPIFY_API_VERSION = '2024-01';
const GRAPHQL_URL = 'https://' + SHOPIFY_DOMAIN + '/api/' + SHOPIFY_API_VERSION + '/graphql.json';

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const token = env.SHOPIFY_STOREFRONT_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'SHOPIFY_STOREFRONT_TOKEN not configured' }, 500);
  }

  try {
    const { query, variables } = await request.json();

    if (!query || typeof query !== 'string') {
      return jsonResponse({ error: 'query is required and must be a string' }, 400);
    }

    const shopifyResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables: variables || {} }),
    });

    const data = await shopifyResponse.json();

    return new Response(JSON.stringify(data), {
      status: shopifyResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
