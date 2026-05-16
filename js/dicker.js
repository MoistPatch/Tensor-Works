(function () {
  'use strict';

  var CACHE_KEY = 'tw_dd_cache';
  var CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function loadCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveCache(cache) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  function getCached(key) {
    var cache = loadCache();
    var entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  }

  function setCache(key, data) {
    var cache = loadCache();
    cache[key] = { ts: Date.now(), data: data };
    saveCache(cache);
  }

  async function fetchStock(sku) {
    if (!sku) return null;
    var cacheKey = 'stock_' + sku;
    var cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 5000);
      var proxy = (window.TW && window.TW.dickerData && window.TW.dickerData.stockProxy) || '/api/stock';
      var res = await fetch(proxy + '?sku=' + encodeURIComponent(sku), { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      setCache(cacheKey, data);
      return data;
    } catch (err) {
      if (!window.TW._ddWarned) {
        console.warn('[TensorWorks] Dicker Data stock fetch failed, using static fallback:', err.message);
        window.TW._ddWarned = true;
      }
      return null;
    }
  }

  async function fetchPricing(sku) {
    if (!sku) return null;
    var cacheKey = 'pricing_' + sku;
    var cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 5000);
      var proxy = (window.TW && window.TW.dickerData && window.TW.dickerData.pricingProxy) || '/api/pricing';
      var res = await fetch(proxy + '?sku=' + encodeURIComponent(sku), { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      setCache(cacheKey, data);
      return data;
    } catch (err) {
      if (!window.TW._ddPricingWarned) {
        console.warn('[TensorWorks] Dicker Data pricing fetch failed:', err.message);
        window.TW._ddPricingWarned = true;
      }
      return null;
    }
  }

  function updateStockBadge(el, stockData) {
    if (!el || !stockData) return;
    var badge = el.querySelector('.stock-badge');
    if (!badge) return;
    if (stockData.mock) return; // keep static badge when mock
    if (stockData.available && stockData.quantity > 5) {
      badge.className = 'stock-badge stock-in';
      badge.innerHTML = '<i class="fas fa-circle"></i> In Stock';
    } else if (stockData.available && stockData.quantity > 0) {
      badge.className = 'stock-badge stock-low';
      badge.innerHTML = '<i class="fas fa-circle"></i> Low Stock (' + stockData.quantity + ' left)';
    } else {
      badge.className = 'stock-badge stock-order';
      badge.innerHTML = '<i class="fas fa-clock"></i> On Order' + (stockData.leadDays ? ' (' + stockData.leadDays + 'd)' : '');
    }
  }

  async function enrichProduct(productEl, sku) {
    if (!productEl || !sku) return;
    var enabled = window.TW && window.TW.dickerData && window.TW.dickerData.enabled;
    if (!enabled) return;

    var stockData = await fetchStock(sku);
    if (stockData && !stockData.mock) {
      updateStockBadge(productEl, stockData);
    }

    var pricingData = await fetchPricing(sku);
    if (pricingData && !pricingData.mock && pricingData.price) {
      var priceEl = productEl.querySelector('.product-price');
      if (priceEl) {
        priceEl.textContent = 'A$' + Number(pricingData.price).toLocaleString('en-AU', { minimumFractionDigits: 2 });
      }
    }
  }

  window.DickerData = {
    fetchStock: fetchStock,
    fetchPricing: fetchPricing,
    enrichProduct: enrichProduct,
    updateStockBadge: updateStockBadge,
  };
})();
