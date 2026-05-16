function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

const SYSTEM_PROMPT = `You are a product data specialist for Tensor Works, an Australian B2B reseller of AI hardware and software (NVIDIA, Dell, Mellanox). Your job is to produce accurate, professional product listings.

Rules:
- ONLY use verified, publicly documented specifications. If a spec is uncertain, omit it.
- Descriptions must be factual, technical, and written for Australian enterprise buyers.
- Do not invent numbers. Do not hallucinate specs.
- Image URLs must be from official manufacturer domains (nvidia.com, dell.com, mellanox.com / nvidia.com/networking). Return null if you are not confident the URL is real and accessible.
- Respond ONLY with valid JSON matching the schema below — no markdown, no commentary.

Output schema:
{
  "description": "string (150-220 words, professional, technical, third-person)",
  "specs": [{"key": "string", "value": "string"}],
  "tags": ["string"],
  "imageUrl": "string or null",
  "productPageUrl": "string (official manufacturer product page)"
}`;

function buildPrompt(title, sku, category, handle) {
  return `Research this product and return a complete, accurate product listing.

Product:
- Title: ${title}
- SKU: ${sku}
- Category: ${category}
- Handle: ${handle}

Return the JSON object as specified. Include all key technical specifications (memory, bandwidth, compute, power, form factor, connectivity, etc.) that are publicly verified for this product. Write the description for an Australian enterprise buyer evaluating this for AI/HPC workloads.`;
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

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { title, sku, category, handle } = body;
  if (!title) return jsonResponse({ error: 'title is required' }, 400);

  const prompt = buildPrompt(title || '', sku || '', category || '', handle || '');

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return jsonResponse({ error: 'Failed to reach Anthropic API: ' + e.message }, 502);
  }

  if (!anthropicRes.ok) {
    const err = await anthropicRes.json().catch(() => ({}));
    return jsonResponse({ error: err.error?.message || 'Anthropic API error ' + anthropicRes.status }, 502);
  }

  const anthropicData = await anthropicRes.json();
  const text = (anthropicData.content || [])[0]?.text || '';

  let result;
  try {
    // Strip any accidental markdown fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    result = JSON.parse(clean);
  } catch (_) {
    return jsonResponse({ error: 'Agent returned malformed JSON', raw: text }, 502);
  }

  return jsonResponse({
    description: result.description || null,
    specs: Array.isArray(result.specs) ? result.specs : [],
    tags: Array.isArray(result.tags) ? result.tags : [],
    imageUrl: result.imageUrl || null,
    productPageUrl: result.productPageUrl || null,
  });
}
