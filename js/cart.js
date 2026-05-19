(function () {
  'use strict';

  var STORAGE_KEY = 'tw_cart';

  function loadCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { cartId: null, items: [], updatedAt: null };
  }

  function saveCart(cart) {
    cart.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {}
  }

  function buildCheckoutUrl(items) {
    var tw = window.TW;
    if (!tw || !tw.shopify || !tw.shopify.configured) return null;
    var lines = items
      .filter(function (i) { return i.variantId; })
      .map(function (i) { return i.variantId + ':' + i.quantity; });
    if (!lines.length) return null;
    var returnUrl = encodeURIComponent(
      (tw.shopify.returnDomain || window.location.origin) + '/thank-you'
    );
    return 'https://' + tw.shopify.domain + '/cart/' + lines.join(',') +
      '?return_to=' + returnUrl;
  }

  var CartManager = {
    _drawerOpen: false,

    get: function () {
      return loadCart();
    },

    add: function (product, variantId, qty) {
      qty = qty || 1;
      var cart = loadCart();
      var existing = cart.items.find(function (i) { return i.handle === product.handle; });
      if (existing) {
        existing.quantity += qty;
      } else {
        cart.items.push({
          handle: product.handle,
          variantId: variantId || product.shopifyVariantId || null,
          title: product.title,
          price: product.priceDisplay || 'POA',
          quantity: qty,
          sku: product.sku,
          image: product.image || null,
          icon: product.icon || 'fa-microchip',
          iconClass: product.iconClass || 'teal',
        });
      }
      saveCart(cart);

      // checkout URL is built dynamically from variant IDs — no API call needed

      CartManager.renderCartBadge();
      CartManager.renderCartDrawer();
      CartManager.openDrawer();
    },

    update: function (handle, qty) {
      var cart = loadCart();
      var item = cart.items.find(function (i) { return i.handle === handle; });
      if (!item) return;
      if (qty <= 0) {
        return CartManager.remove(handle);
      }
      item.quantity = qty;
      saveCart(cart);
      CartManager.renderCartBadge();
      CartManager.renderCartDrawer();
      if (document.getElementById('cart-page')) CartManager.renderCartPage();
    },

    remove: function (handle) {
      var cart = loadCart();
      cart.items = cart.items.filter(function (i) { return i.handle !== handle; });
      saveCart(cart);
      CartManager.renderCartBadge();
      CartManager.renderCartDrawer();
      if (document.getElementById('cart-page')) CartManager.renderCartPage();
    },

    clear: function () {
      saveCart({ cartId: null, items: [], updatedAt: null });
      CartManager.renderCartBadge();
      CartManager.renderCartDrawer();
      if (document.getElementById('cart-page')) CartManager.renderCartPage();
    },

    total: function () {
      var cart = loadCart();
      return cart.items.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    },

    count: function () {
      return CartManager.total();
    },

    renderCartBadge: function () {
      var count = CartManager.count();
      var badges = document.querySelectorAll('.cart-count');
      badges.forEach(function (el) {
        el.textContent = count;
        el.setAttribute('data-count', count);
      });
    },

    openDrawer: function () {
      CartManager._ensureDrawer();
      var drawer = document.getElementById('cart-drawer');
      var overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      CartManager._drawerOpen = true;
    },

    closeDrawer: function () {
      var drawer = document.getElementById('cart-drawer');
      var overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      CartManager._drawerOpen = false;
    },

    toggleDrawer: function () {
      if (CartManager._drawerOpen) {
        CartManager.closeDrawer();
      } else {
        CartManager._ensureDrawer();
        CartManager.renderCartDrawer();
        CartManager.openDrawer();
      }
    },

    _ensureDrawer: function () {
      if (!document.getElementById('cart-drawer')) {
        var drawer = document.createElement('div');
        drawer.id = 'cart-drawer';
        document.body.appendChild(drawer);
      }
      if (!document.getElementById('cart-overlay')) {
        var overlay = document.createElement('div');
        overlay.id = 'cart-overlay';
        overlay.onclick = function () { CartManager.closeDrawer(); };
        document.body.appendChild(overlay);
      }
    },

    renderCartDrawer: function () {
      CartManager._ensureDrawer();
      var drawer = document.getElementById('cart-drawer');
      if (!drawer) return;
      var cart = loadCart();
      var items = cart.items;
      var configured = window.TW && window.TW.shopify && window.TW.shopify.configured;

      var itemsHTML = '';
      if (items.length === 0) {
        itemsHTML = '<div class="cd-empty"><i class="fas fa-shopping-cart" style="font-size:32px;color:var(--txt3);margin-bottom:12px"></i><p>Your cart is empty</p><a href="/products.html" class="btn btn-primary" style="margin-top:16px" onclick="Cart.closeDrawer()">Browse Products</a></div>';
      } else {
        items.forEach(function (item) {
          var iconBg = {teal:'rgba(13,115,119,.2)',orange:'rgba(224,123,57,.15)',blue:'rgba(88,166,255,.1)',purple:'rgba(160,100,255,.1)',green:'rgba(0,200,100,.1)'}[item.iconClass] || 'rgba(13,115,119,.2)';
          var iconColor = {teal:'var(--teal-lt)',orange:'var(--orange-lt)',blue:'#58a6ff',purple:'#b084ff',green:'#3ddc84'}[item.iconClass] || 'var(--teal-lt)';
          itemsHTML += '<div class="cd-item">' +
            '<div class="cd-item-icon" style="background:' + iconBg + ';color:' + iconColor + '"><i class="fas ' + item.icon + '"></i></div>' +
            '<div class="cd-item-info">' +
              '<div class="cd-item-title">' + item.title + '</div>' +
              '<div class="cd-item-sku">' + item.sku + '</div>' +
              '<div class="cd-item-price">' + item.price + '</div>' +
            '</div>' +
            '<div class="cd-item-controls">' +
              '<button class="cd-qty-btn" onclick="Cart.update(\'' + item.handle + '\',' + (item.quantity - 1) + ')">−</button>' +
              '<span class="cd-qty">' + item.quantity + '</span>' +
              '<button class="cd-qty-btn" onclick="Cart.update(\'' + item.handle + '\',' + (item.quantity + 1) + ')">+</button>' +
              '<button class="cd-remove" onclick="Cart.remove(\'' + item.handle + '\')" title="Remove"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
          '</div>';
        });
      }

      var subtotalCount = items.reduce(function (s, i) { return s + i.quantity; }, 0);
      var checkoutUrl = buildCheckoutUrl(items);
      var checkoutHTML = '';
      if (checkoutUrl) {
        checkoutHTML = '<a href="' + checkoutUrl + '" class="btn btn-primary" style="width:100%;justify-content:center">Checkout <i class="fas fa-arrow-right"></i></a>';
      } else if (items.length > 0) {
        checkoutHTML = '<a href="/cart.html" class="btn btn-primary" style="width:100%;justify-content:center" onclick="Cart.closeDrawer()">View Basket <i class="fas fa-arrow-right"></i></a>';
      }

      drawer.innerHTML =
        '<div class="cd-header">' +
          '<span class="cd-title"><i class="fas fa-shopping-cart"></i> Cart (' + subtotalCount + ')</span>' +
          '<button class="cd-close" onclick="Cart.closeDrawer()"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="cd-body">' + itemsHTML + '</div>' +
        (items.length > 0 ? '<div class="cd-footer">' +
          '<div class="cd-subtotal"><span>Items</span><span>' + subtotalCount + ' item' + (subtotalCount !== 1 ? 's' : '') + '</span></div>' +
          '<div class="cd-note">All prices are POA — submit an enquiry for a formal quote</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
            checkoutHTML +
            '<a href="/cart.html" class="btn btn-outline" style="width:100%;justify-content:center" onclick="Cart.closeDrawer()">View Cart</a>' +
          '</div>' +
        '</div>' : '');
    },

    renderCartPage: function () {
      var el = document.getElementById('cart-page');
      if (!el) return;
      var cart = loadCart();
      var items = cart.items;
      var configured = window.TW && window.TW.shopify && window.TW.shopify.configured;

      if (items.length === 0) {
        el.innerHTML = '<div class="cart-empty">' +
          '<i class="fas fa-shopping-cart" style="font-size:56px;color:var(--txt3);margin-bottom:24px"></i>' +
          '<h2 style="color:var(--white);margin-bottom:12px">Your cart is empty</h2>' +
          '<p style="color:var(--txt2);margin-bottom:32px">Browse our catalogue and add items to your cart.</p>' +
          '<a href="/products.html" class="btn btn-primary"><i class="fas fa-microchip"></i> Browse Products</a>' +
        '</div>';
        return;
      }

      var rowsHTML = items.map(function (item) {
        var iconBg = {teal:'rgba(13,115,119,.2)',orange:'rgba(224,123,57,.15)',blue:'rgba(88,166,255,.1)',purple:'rgba(160,100,255,.1)',green:'rgba(0,200,100,.1)'}[item.iconClass] || 'rgba(13,115,119,.2)';
        var iconColor = {teal:'var(--teal-lt)',orange:'var(--orange-lt)',blue:'#58a6ff',purple:'#b084ff',green:'#3ddc84'}[item.iconClass] || 'var(--teal-lt)';
        return '<tr>' +
          '<td><div class="cart-item-img" style="background:' + iconBg + ';color:' + iconColor + '"><i class="fas ' + item.icon + '"></i></div></td>' +
          '<td><div class="cart-item-title">' + item.title + '</div><div class="cart-item-sku">SKU: ' + item.sku + '</div></td>' +
          '<td>' + item.price + '</td>' +
          '<td><div class="cart-qty-ctrl">' +
            '<button class="cd-qty-btn" onclick="Cart.update(\'' + item.handle + '\',' + (item.quantity - 1) + ')">−</button>' +
            '<span class="cd-qty">' + item.quantity + '</span>' +
            '<button class="cd-qty-btn" onclick="Cart.update(\'' + item.handle + '\',' + (item.quantity + 1) + ')">+</button>' +
          '</div></td>' +
          '<td>' + item.price + '</td>' +
          '<td><button class="cart-remove-btn" onclick="Cart.remove(\'' + item.handle + '\')"><i class="fas fa-trash-alt"></i></button></td>' +
        '</tr>';
      }).join('');

      var totalItems = items.reduce(function (s, i) { return s + i.quantity; }, 0);

      var checkoutUrl = buildCheckoutUrl(items);
      var paymentMethods =
        '<div style="margin-bottom:10px">' +
          (checkoutUrl
            ? '<a href="' + checkoutUrl + '" class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px">Proceed to Checkout <i class="fas fa-arrow-right"></i></a>' +
              '<a href="' + checkoutUrl + '?payment=shop_pay" class="tw-shop-pay-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:#5a31f4;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;margin-bottom:8px">' +
                '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7z" fill="#fff" fill-opacity=".2"/><path d="M4.5 4.5h5v5h-5z" fill="#fff"/></svg>' +
                'Buy with Shop Pay' +
              '</a>'
            : '<a href="/#enquiry" class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px"><i class="fas fa-file-invoice-dollar"></i> Request Quote &amp; Invoice</a>') +
          '<div style="display:flex;align-items:center;gap:8px;margin:10px 0">' +
            '<div style="flex:1;height:1px;background:var(--bdr)"></div>' +
            '<span style="font-size:11px;color:var(--txt3);white-space:nowrap">or pay with</span>' +
            '<div style="flex:1;height:1px;background:var(--bdr)"></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:10px">' +
            '<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;color:var(--txt2);display:flex;align-items:center;gap:4px"><i class="fab fa-apple" style="font-size:13px"></i> Pay</div>' +
            '<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;color:var(--txt2);display:flex;align-items:center;gap:4px"><i class="fab fa-google" style="font-size:13px"></i> Pay</div>' +
            '<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;color:var(--txt2)">Afterpay</div>' +
            '<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;color:var(--txt2)">EFT</div>' +
          '</div>' +
          '<p style="font-size:11px;color:var(--txt3);text-align:center;margin:0">Apple Pay &amp; Google Pay available at checkout. Afterpay for orders under $2,000.</p>' +
        '</div>';
      var checkoutBtn = paymentMethods;

      el.innerHTML = '<div class="cart-layout">' +
        '<div class="cart-main">' +
          '<div class="cart-table-wrap">' +
            '<table class="cart-table">' +
              '<thead><tr><th></th><th>Product</th><th>Unit Price</th><th>Qty</th><th>Total</th><th></th></tr></thead>' +
              '<tbody>' + rowsHTML + '</tbody>' +
            '</table>' +
          '</div>' +
          '<div class="cart-continue"><a href="/products.html" class="btn btn-outline"><i class="fas fa-arrow-left"></i> Continue Shopping</a></div>' +
        '</div>' +
        '<div class="cart-sidebar">' +
          '<div class="cart-summary">' +
            '<h3 class="cart-summary-title">Order Summary</h3>' +
            '<div class="cart-summary-row"><span>Items (' + totalItems + ')</span><span>POA</span></div>' +
            '<div class="cart-summary-row"><span>Shipping</span><span>TBC</span></div>' +
            '<div class="cart-summary-row"><span>GST</span><span>Included</span></div>' +
            '<div class="cart-summary-divider"></div>' +
            '<div class="cart-summary-row cart-summary-total"><span>Total</span><span>POA</span></div>' +
            '<div class="cart-summary-note">All prices are Price on Application. A formal quote will be provided within 1 business day.</div>' +
            checkoutBtn +
            '<button class="btn btn-outline" style="width:100%;justify-content:center;font-size:13px;padding:10px" onclick="Cart.clear()">Clear Cart</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    },
  };

  // Inject cart UI styles
  var style = document.createElement('style');
  style.textContent = [
    '#cart-drawer{position:fixed;top:0;right:-400px;width:380px;max-width:100vw;height:100vh;background:var(--bg2);border-left:1px solid var(--bdr);z-index:1000;transition:.3s ease;display:flex;flex-direction:column;}',
    '#cart-drawer.open{right:0;}',
    '#cart-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999;}',
    '#cart-overlay.open{display:block;}',
    '.cart-btn{position:relative;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--rsm);color:var(--txt);width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
    '.cart-count{position:absolute;top:-6px;right:-6px;background:var(--teal);color:#fff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s;}',
    '.cart-count:not([data-count="0"]){opacity:1;}',
    '.cd-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 16px;border-bottom:1px solid var(--bdr);flex-shrink:0;}',
    '.cd-title{font-size:16px;font-weight:700;color:var(--white);}',
    '.cd-close{background:none;border:none;color:var(--txt2);font-size:18px;cursor:pointer;padding:4px;transition:.2s;}',
    '.cd-close:hover{color:var(--white);}',
    '.cd-body{flex:1;overflow-y:auto;padding:16px;}',
    '.cd-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--txt2);}',
    '.cd-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--bdr);}',
    '.cd-item:last-child{border-bottom:none;}',
    '.cd-item-icon{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}',
    '.cd-item-info{flex:1;min-width:0;}',
    '.cd-item-title{font-size:13px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.cd-item-sku{font-size:11px;color:var(--txt3);}',
    '.cd-item-price{font-size:12px;color:var(--teal-lt);font-weight:600;}',
    '.cd-item-controls{display:flex;align-items:center;gap:6px;flex-shrink:0;}',
    '.cd-qty-btn{background:var(--bg3);border:1px solid var(--bdr);color:var(--txt);width:26px;height:26px;border-radius:4px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;}',
    '.cd-qty-btn:hover{border-color:var(--teal);color:var(--teal-lt);}',
    '.cd-qty{font-size:13px;font-weight:600;color:var(--white);min-width:20px;text-align:center;}',
    '.cd-remove{background:none;border:none;color:var(--txt3);cursor:pointer;padding:4px;font-size:12px;}',
    '.cd-remove:hover{color:#f85149;}',
    '.cd-footer{padding:16px;border-top:1px solid var(--bdr);flex-shrink:0;}',
    '.cd-subtotal{display:flex;justify-content:space-between;font-size:14px;font-weight:600;color:var(--white);margin-bottom:8px;}',
    '.cd-note{font-size:11px;color:var(--txt3);margin-bottom:12px;line-height:1.5;}',
    '.cart-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;}',
    '.cart-layout{display:grid;grid-template-columns:1fr 340px;gap:32px;align-items:start;}',
    '@media(max-width:860px){.cart-layout{grid-template-columns:1fr;}}',
    '.cart-table-wrap{overflow-x:auto;}',
    '.cart-table{width:100%;border-collapse:collapse;}',
    '.cart-table th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);padding:10px 12px;text-align:left;border-bottom:1px solid var(--bdr);}',
    '.cart-table td{padding:16px 12px;border-bottom:1px solid var(--bdr);font-size:14px;color:var(--txt2);vertical-align:middle;}',
    '.cart-item-img{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;}',
    '.cart-item-title{font-size:14px;font-weight:600;color:var(--white);margin-bottom:2px;}',
    '.cart-item-sku{font-size:11px;color:var(--txt3);}',
    '.cart-qty-ctrl{display:flex;align-items:center;gap:6px;}',
    '.cart-remove-btn{background:none;border:none;color:var(--txt3);cursor:pointer;font-size:14px;padding:6px;}',
    '.cart-remove-btn:hover{color:#f85149;}',
    '.cart-continue{margin-top:16px;}',
    '.cart-summary{background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r);padding:28px;}',
    '.cart-summary-title{font-size:16px;font-weight:700;color:var(--white);margin-bottom:20px;}',
    '.cart-summary-row{display:flex;justify-content:space-between;font-size:14px;color:var(--txt2);margin-bottom:10px;}',
    '.cart-summary-divider{border-top:1px solid var(--bdr);margin:14px 0;}',
    '.cart-summary-total{font-size:16px;font-weight:700;color:var(--white);margin-bottom:16px;}',
    '.cart-summary-note{font-size:12px;color:var(--txt3);margin-bottom:16px;line-height:1.5;}',
  ].join('');
  document.head.appendChild(style);

  window.Cart = CartManager;
})();
