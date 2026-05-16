(function () {
  'use strict';

  function injectNav(activePage) {
    var header = document.getElementById('site-header');
    if (!header) return;

    var links = [
      { href: '/', label: 'Home', key: 'home' },
      { href: '/products.html', label: 'Products', key: 'products' },
      { href: '/#enquiry', label: 'Enquire', key: 'enquiry' },
      { href: '/account.html', label: 'Account', key: 'account' },
    ];

    var navLinksHTML = links.map(function (l) {
      var active = l.key === activePage ? ' style="color:var(--white);background:var(--bg3)"' : '';
      return '<a href="' + l.href + '"' + active + '>' + l.label + '</a>';
    }).join('');

    header.innerHTML =
      '<div class="container">' +
        '<div class="header-inner">' +
          '<a href="/" class="logo"><div class="logo-mark">TW</div>Tensor<span>Works</span></a>' +
          '<nav id="nav">' + navLinksHTML + '</nav>' +
          '<div class="header-cta">' +
            '<button class="cart-btn" onclick="Cart.toggleDrawer()" aria-label="Shopping cart">' +
              '<i class="fas fa-shopping-cart" aria-hidden="true"></i>' +
              '<span class="cart-count" data-count="0">0</span>' +
            '</button>' +
            '<a href="/products.html" class="btn btn-primary">Shop Now</a>' +
            '<button class="hamburger" aria-label="Toggle navigation" onclick="document.getElementById(\'nav\').classList.toggle(\'open\')">' +
              '<i class="fas fa-bars" aria-hidden="true"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function injectFooter() {
    var footer = document.getElementById('site-footer');
    if (!footer) return;

    footer.innerHTML =
      '<div class="container">' +
        '<div class="footer-inner">' +
          '<div class="footer-brand">' +
            '<a href="/" class="logo">' +
              '<div class="logo-mark">TW</div>' +
              'Tensor<span>Works</span>' +
            '</a>' +
            '<p>Enterprise AI hardware supply and consulting for Australian government, research and enterprise organisations.</p>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h4>Hardware</h4>' +
            '<a href="/products.html">H100 GPU</a>' +
            '<a href="/products.html">DGX H200</a>' +
            '<a href="/products.html">RTX 6000 Ada</a>' +
            '<a href="/products.html">BlueField-3 DPU</a>' +
            '<a href="/products.html">AI Enterprise</a>' +
            '<a href="/products.html">PowerEdge XE9680</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h4>Company</h4>' +
            '<a href="/#features">Why Tensor Works</a>' +
            '<a href="/#enquiry">Contact</a>' +
            '<a href="/privacy.html">Privacy Policy</a>' +
            '<a href="/terms.html">Terms of Service</a>' +
            '<a href="mailto:sam@vantyx.com.au">sam@vantyx.com.au</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<p>© 2026 Tensor Works Pty Ltd. ABN 84 544 119 830. All rights reserved.</p>' +
          '<div style="display:flex;gap:16px">' +
            '<a href="/privacy.html">Privacy</a>' +
            '<a href="/terms.html">Terms</a>' +
            '<a href="mailto:sam@vantyx.com.au">sam@vantyx.com.au</a>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  window.injectNav = injectNav;
  window.injectFooter = injectFooter;
})();

// Analytics beacon - tracks page views and product interactions
(function() {
  var session = { date: new Date().toISOString().slice(0,10), pages: [], products: [], events: [] };
  var startTime = Date.now();
  var currentPath = window.location.pathname;

  function recordPage() {
    session.pages.push({ path: currentPath, duration: 0 });
  }

  function updateDuration() {
    if (session.pages.length) {
      session.pages[session.pages.length - 1].duration = Math.round((Date.now() - startTime) / 1000);
    }
  }

  function recordProductView(handle) {
    if (handle && session.products.indexOf(handle) === -1) session.products.push(handle);
    session.events.push({ type: 'product_view', handle: handle, at: Date.now() });
  }

  function sendSession() {
    updateDuration();
    if (session.pages.length === 0 && session.products.length === 0) return;
    var data = JSON.stringify({ session: session });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', new Blob([data], { type: 'application/json' }));
    } else {
      fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(function(){});
    }
  }

  recordPage();
  window.addEventListener('beforeunload', sendSession);

  // Expose for product pages to call
  window.TW = window.TW || {};
  window.TW.analytics = { recordProductView: recordProductView };
})();
