const DEFAULT_BASE_URL = 'https://api.dickerdata.com.au/v2';

const MOCK_CATALOG = [
  {
    sku: 'DD-NV-H100-SXM5-80',
    manufacturerSku: '900-21010-0000-000',
    description: 'NVIDIA H100 SXM5 80GB HBM3 AI Training Accelerator',
    manufacturer: 'NVIDIA',
    category: 'GPU Accelerators',
    costExGst: 38500.00,
    rrpExGst: 45000.00,
    inStock: true,
    stockQty: 3,
    leadTimeDays: 0,
  },
  {
    sku: 'DD-NV-H200-SXM5',
    manufacturerSku: '900-21010-0080-000',
    description: 'NVIDIA H200 SXM5 141GB HBM3e AI Superchip',
    manufacturer: 'NVIDIA',
    category: 'GPU Accelerators',
    costExGst: 52000.00,
    rrpExGst: 62000.00,
    inStock: false,
    stockQty: 0,
    leadTimeDays: 45,
  },
  {
    sku: 'DD-NV-RTX6000-ADA',
    manufacturerSku: '900-5G133-2500-000',
    description: 'NVIDIA RTX 6000 Ada Generation 48GB GDDR6 ECC Workstation GPU',
    manufacturer: 'NVIDIA',
    category: 'Workstation GPU',
    costExGst: 7200.00,
    rrpExGst: 9000.00,
    inStock: true,
    stockQty: 8,
    leadTimeDays: 0,
  },
  {
    sku: 'DD-NV-DGX-H200',
    manufacturerSku: 'DGX-H200-640-SXM5',
    description: 'NVIDIA DGX H200 System — 8x H200 SXM5, 1.1TB HBM3e, 8x 400Gb InfiniBand',
    manufacturer: 'NVIDIA',
    category: 'DGX Systems',
    costExGst: 385000.00,
    rrpExGst: 450000.00,
    inStock: false,
    stockQty: 0,
    leadTimeDays: 90,
  },
  {
    sku: 'DD-NV-BF3-400G',
    manufacturerSku: '900-9D3B6-00CV-AAB',
    description: 'NVIDIA BlueField-3 DPU 400GbE/NDR200 InfiniBand Data Processing Unit',
    manufacturer: 'NVIDIA',
    category: 'Data Processing Unit',
    costExGst: 3100.00,
    rrpExGst: 4000.00,
    inStock: true,
    stockQty: 12,
    leadTimeDays: 0,
  },
];

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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = env.DICKER_DATA_API_KEY;

  if (!apiKey) {
    // No API key configured — return mock catalog
    return jsonResponse({
      connected: false,
      mock: true,
      products: MOCK_CATALOG,
    });
  }

  // Real API call
  const baseUrl = env.DICKER_DATA_BASE_URL || DEFAULT_BASE_URL;

  try {
    const res = await fetch(baseUrl + '/products?manufacturer=NVIDIA&category=GPU', {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'TensorWorks-Admin',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error('Dicker Data API returned HTTP ' + res.status);

    const data = await res.json();

    // Normalise response into consistent format
    const products = Array.isArray(data) ? data : (data.products || data.items || []);

    return jsonResponse({
      connected: true,
      mock: false,
      products,
    });
  } catch (e) {
    return jsonResponse({ error: 'Dicker Data API error: ' + e.message }, 502);
  }
}
