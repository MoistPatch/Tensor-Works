export async function onRequestGet(context) {
  const { request, env } = context;
  const sku = new URL(request.url).searchParams.get('sku');

  if (!sku) {
    return new Response(JSON.stringify({ error: 'sku required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DICKER_DATA_API_KEY || !env.DICKER_DATA_BASE_URL) {
    return new Response(
      JSON.stringify({ price: null, rrp: null, currency: 'AUD', mock: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    const res = await fetch(
      `${env.DICKER_DATA_BASE_URL}/pricing/${encodeURIComponent(sku)}`,
      {
        headers: {
          Authorization: `Bearer ${env.DICKER_DATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const normalized = {
      price: data.price || data.netPrice || null,
      rrp: data.rrp || data.recommendedRetailPrice || null,
      currency: data.currency || 'AUD',
      updatedAt: data.updatedAt || new Date().toISOString(),
    };

    return new Response(JSON.stringify(normalized), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'unavailable', message: err.message }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
