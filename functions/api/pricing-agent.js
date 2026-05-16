const OWNER = 'MoistPatch';
const REPO = 'Tensor-Works';
const PRICING_RULES_FILE = 'data/pricing-rules.json';

async function ghGet(path, token) {
  const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TensorWorks-Admin',
    },
  });
  if (!r.ok) throw new Error('GitHub GET ' + path + ' failed: ' + r.status);
  return r.json();
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function roundUpTo(value, nearest) {
  if (!nearest || nearest <= 0) return value;
  return Math.ceil(value / nearest) * nearest;
}

function formatAUD(amount) {
  return 'A$' + amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function fetchRules(token) {
  const file = await ghGet(PRICING_RULES_FILE, token);
  return JSON.parse(atob(file.content.replace(/\s/g, '')));
}

function calculatePricing(costExGst, category, rules) {
  // Determine markup rate for category
  const catConfig = rules.categories && rules.categories[category];
  const markupRate = catConfig ? catConfig.markup : rules.defaultMarkup;
  const minMargin = catConfig ? catConfig.minMargin : 0;

  // Calculate initial retail ex GST
  let retailExGst = costExGst * (1 + markupRate);
  const marginFromMarkup = retailExGst - costExGst;

  // Enforce minimum margin
  if (marginFromMarkup < minMargin) {
    retailExGst = costExGst + minMargin;
  }

  // Round up to nearest roundTo
  retailExGst = roundUpTo(retailExGst, rules.roundTo || 1);

  // Calculate GST (10%)
  const gst = Math.round(retailExGst * 0.10 * 100) / 100;
  const retailIncGst = Math.round((retailExGst + gst) * 100) / 100;

  const margin = Math.round((retailExGst - costExGst) * 100) / 100;
  const marginPct = Math.round((margin / retailExGst) * 10000) / 100;
  const markup = Math.round(markupRate * 10000) / 100;

  return {
    costExGst: Math.round(costExGst * 100) / 100,
    retailExGst: Math.round(retailExGst * 100) / 100,
    gst,
    retailIncGst,
    markup,
    margin,
    marginPct,
    displayPrice: formatAUD(retailIncGst),
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const token = env.GITHUB_PAT;
  if (!token) return jsonResponse({ error: 'GITHUB_PAT environment variable not set' }, 500);

  try {
    if (request.method === 'GET') {
      // Convenience: return current pricing rules
      const file = await ghGet(PRICING_RULES_FILE, token);
      const rules = JSON.parse(atob(file.content.replace(/\s/g, '')));
      return jsonResponse({ rules, sha: file.sha });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { costExGst, category } = body;

      if (typeof costExGst !== 'number' || costExGst <= 0) {
        return jsonResponse({ error: 'costExGst must be a positive number' }, 400);
      }
      if (!category || typeof category !== 'string') {
        return jsonResponse({ error: 'category must be a non-empty string' }, 400);
      }

      const rules = await fetchRules(token);
      const result = calculatePricing(costExGst, category, rules);

      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
