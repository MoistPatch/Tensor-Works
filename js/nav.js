(function () {
  'use strict';

  /* ── AI News Ticker ───────────────────────────────────────────── */
  function injectTicker() {
    // Styles
    var s = document.createElement('style');
    s.textContent = [
      '.tw-ticker{display:flex;align-items:center;height:36px;background:#070c0e;border-bottom:1px solid #1a2830;overflow:hidden;position:relative;z-index:201;font-family:Inter,sans-serif}',
      '.tw-ticker-label{flex-shrink:0;display:flex;align-items:center;gap:7px;padding:0 16px;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#14a8ae;border-right:1px solid #1a2830;height:100%;white-space:nowrap;background:#070c0e}',
      '.tw-ticker-label .tw-dot{width:6px;height:6px;border-radius:50%;background:#14a8ae;animation:tw-pulse 2s infinite}',
      '@keyframes tw-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.3)}}',
      '.tw-ticker-wrap{flex:1;overflow:hidden;position:relative;mask-image:linear-gradient(to right,transparent 0,black 40px,black calc(100% - 40px),transparent 100%);-webkit-mask-image:linear-gradient(to right,transparent 0,black 40px,black calc(100% - 40px),transparent 100%)}',
      '.tw-ticker-track{display:flex;gap:0;white-space:nowrap;animation:tw-scroll 80s linear infinite;will-change:transform}',
      '.tw-ticker-track:hover{animation-play-state:paused}',
      '@keyframes tw-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}',
      '.tw-ticker-item{display:inline-flex;align-items:center;gap:10px;padding:0 32px;font-size:12px;color:#8fa8b2;cursor:pointer;transition:color .2s;text-decoration:none}',
      '.tw-ticker-item:hover{color:#fff}',
      '.tw-ticker-item .tw-src{font-size:10px;font-weight:700;color:#0D7377;text-transform:uppercase;letter-spacing:.8px}',
      '.tw-ticker-sep{color:#1a2830;font-size:16px;flex-shrink:0}',
    ].join('');
    document.head.appendChild(s);

    // Element
    var bar = document.createElement('div');
    bar.className = 'tw-ticker';
    bar.id = 'tw-ticker';
    bar.innerHTML =
      '<div class="tw-ticker-label"><span class="tw-dot"></span>AI News</div>' +
      '<div class="tw-ticker-wrap"><div class="tw-ticker-track" id="tw-track">Loading…</div></div>';

    var header = document.getElementById('site-header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header);

    // Fetch and render
    fetch('/api/ai-news')
      .then(function(r){ return r.json(); })
      .then(function(data){
        var articles = data.articles || [];
        if (!articles.length) { bar.style.display = 'none'; return; }
        // Duplicate for seamless loop
        var all = articles.concat(articles);
        var html = all.map(function(a, i){
          var src = a.source ? '<span class="tw-src">' + esc(a.source) + '</span>' : '';
          var sep = i < all.length - 1 ? '<span class="tw-sep">·</span>' : '';
          return (
            '<a class="tw-ticker-item" href="' + esc(a.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
              src + esc(a.title) +
            '</a>' + sep
          );
        }).join('');
        document.getElementById('tw-track').innerHTML = html;
      })
      .catch(function(){ bar.style.display = 'none'; });

    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  }

  function injectNav(activePage) {
    var header = document.getElementById('site-header');
    if (!header) return;

    injectTicker();

    var links = [
      { href: '/', label: 'Home', key: 'home' },
      { href: '/#solutions', label: 'Solutions', key: 'solutions' },
      { href: '/#enquiry', label: 'OEM / ODM', key: 'oem' },
      { href: '/#industries', label: 'Industries', key: 'industries' },
    ];

    var navLinksHTML = links.map(function (l) {
      var active = l.key === activePage ? ' style="color:var(--white);background:var(--bg3)"' : '';
      return '<a href="' + l.href + '"' + active + '>' + l.label + '</a>';
    }).join('');

    var logoHTML = (window.TW && window.TW.Logo)
      ? window.TW.Logo.NavLogo()
      : '<a href="/" class="logo"><div class="logo-mark">TW</div>Tensor<span>Works</span></a>';

    header.innerHTML =
      '<div class="container">' +
        '<div class="header-inner">' +
          logoHTML +
          '<nav id="nav">' + navLinksHTML + '</nav>' +
          '<div class="header-cta">' +
            '<button class="cart-btn" onclick="Cart.toggleDrawer()" aria-label="Shopping cart">' +
              '<i class="fas fa-shopping-cart" aria-hidden="true"></i>' +
              '<span class="cart-count" data-count="0">0</span>' +
            '</button>' +
            '<a href="/#enquiry" class="btn btn-primary">Request a Quote</a>' +
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
            '<p>Custom AI compute systems — LLM inference, training clusters, OEM/ODM manufacturing, and end-to-end hardware solutions for Australian organisations.</p>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h4>Solutions</h4>' +
            '<a href="/#solutions">LLM Inference Systems</a>' +
            '<a href="/#solutions">Training Clusters</a>' +
            '<a href="/#solutions">OEM / ODM Builds</a>' +
            '<a href="/#solutions">Edge AI Appliances</a>' +
            '<a href="/#solutions">Quant &amp; HPC</a>' +
            '<a href="/#solutions">Custom Clusters</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h4>Company</h4>' +
            '<a href="/#capabilities">Capabilities</a>' +
            '<a href="/#industries">Industries</a>' +
            '<a href="/#enquiry">Request a Quote</a>' +
            '<a href="/privacy.html">Privacy Policy</a>' +
            '<a href="/terms.html">Terms of Service</a>' +
            '<a href="mailto:sales@tensorworks.online">sales@tensorworks.online</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<p>© 2026 Tensor Works Pty Ltd. ABN 84 544 119 830. All rights reserved.</p>' +
          '<div style="display:flex;gap:16px">' +
            '<a href="/privacy.html">Privacy</a>' +
            '<a href="/terms.html">Terms</a>' +
            '<a href="mailto:sales@tensorworks.online">sales@tensorworks.online</a>' +
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
