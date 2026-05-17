(function () {
  'use strict';

  /* ── SVG mark path data ─────────────────────────────────────── */
  var MARK_SVG = function (opts) {
    var p  = opts.primary   || 'var(--tw-logo-primary, #1F5C99)';
    var a  = opts.accent    || 'var(--tw-logo-accent,  #76B900)';
    var sz = opts.size      || 64;
    var id = opts.id        || '';
    var cls = opts.animate  ? ' tw-logo-animate' : '';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + sz + '" height="' + sz + '" viewBox="0 0 100 100"' +
        ' class="tw-logo-mark' + cls + '" role="img" aria-label="TensorWorks"' +
        (id ? ' id="' + id + '"' : '') + '>' +
        '<title>TensorWorks</title>' +
        '<line x1="50" y1="50" x2="50" y2="20" stroke="' + p + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<line x1="50" y1="50" x2="76" y2="35" stroke="' + p + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<line x1="50" y1="50" x2="76" y2="65" stroke="' + p + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<line x1="50" y1="50" x2="50" y2="80" stroke="' + p + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<line x1="50" y1="50" x2="24" y2="65" stroke="' + p + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<line x1="50" y1="50" x2="24" y2="35" stroke="' + p + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>' +
        '<polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="none" stroke="' + a + '" stroke-width="1.2" opacity=".28"/>' +
        '<circle cx="50" cy="20" r="7.5" fill="' + a + '"/>' +
        '<circle cx="76" cy="35" r="7.5" fill="' + a + '"/>' +
        '<circle cx="76" cy="65" r="7.5" fill="' + a + '"/>' +
        '<circle cx="50" cy="80" r="7.5" fill="' + a + '"/>' +
        '<circle cx="24" cy="65" r="7.5" fill="' + a + '"/>' +
        '<circle cx="24" cy="35" r="7.5" fill="' + a + '"/>' +
        '<circle cx="50" cy="50" r="19" fill="' + p + '" opacity=".18"/>' +
        '<circle cx="50" cy="50" r="15" fill="' + p + '"/>' +
        '<circle cx="50" cy="50" r="8" fill="#2D7EC4" opacity=".55"/>' +
        '<circle cx="46" cy="46" r="3.5" fill="#fff" opacity=".22"/>' +
      '</svg>'
    );
  };

  /* ── Size maps ──────────────────────────────────────────────── */
  var MARK_SIZES = { xs: 16, sm: 32, md: 64, lg: 128, xl: 256 };

  /* ── Color resolvers ────────────────────────────────────────── */
  function resolveColors(variant) {
    switch (variant) {
      case 'accent':      return { primary: '#76B900', accent: '#1F5C99' };
      case 'monochrome':  return { primary: 'currentColor', accent: 'currentColor' };
      case 'inverted':    return { primary: '#ffffff', accent: '#ffffff' };
      default:            return { primary: '#1F5C99', accent: '#76B900' };
    }
  }

  /* ── LogoMark ───────────────────────────────────────────────── */
  function LogoMark(opts) {
    opts = opts || {};
    var sz     = MARK_SIZES[opts.size] || opts.size || MARK_SIZES.lg;
    var colors = resolveColors(opts.color);
    return MARK_SVG({ size: sz, primary: colors.primary, accent: colors.accent, animate: opts.animate, id: opts.id });
  }

  /* ── LogoHorizontal ─────────────────────────────────────────── */
  var H_ICON_SIZES   = { sm: 28, md: 44, lg: 56, xl: 80 };
  var H_NAME_SIZES   = { sm: '15px', md: '22px', lg: '26px', xl: '36px' };
  var H_SUB_SIZES    = { sm: '8px',  md: '9.5px', lg: '10.5px', xl: '14px' };
  var H_SUB_SPACING  = { sm: '1.8px', md: '2px', lg: '2.4px', xl: '3px' };

  function LogoHorizontal(opts) {
    opts = opts || {};
    var sKey   = opts.size  || 'md';
    var colors = resolveColors(opts.color);
    var mark   = MARK_SVG({ size: H_ICON_SIZES[sKey] || 44, primary: colors.primary, accent: colors.accent });
    var pColor = colors.primary === 'currentColor' ? 'currentColor' : colors.primary;
    var aColor = colors.accent  === 'currentColor' ? 'currentColor' : colors.accent;
    var hideSub = opts.hiddenSubtext;
    return (
      '<div class="tw-logo tw-logo-horizontal tw-logo-' + sKey + '" style="display:flex;align-items:center;gap:12px;text-decoration:none">' +
        mark +
        '<div class="tw-logo-text">' +
          '<div class="tw-logo-wordmark" style="font-family:Inter,system-ui,sans-serif;font-weight:900;font-size:' + H_NAME_SIZES[sKey] + ';letter-spacing:-0.4px;line-height:1;color:' + pColor + '">' +
            'Tensor<span style="color:' + aColor + '">Works</span>' +
          '</div>' +
          (!hideSub
            ? '<div class="tw-logo-sub" style="font-family:Inter,system-ui,sans-serif;font-size:' + H_SUB_SIZES[sKey] + ';font-weight:700;letter-spacing:' + H_SUB_SPACING[sKey] + ';text-transform:uppercase;color:#666;margin-top:3px">AI Hardware Solutions</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  /* ── LogoVertical ───────────────────────────────────────────── */
  var V_ICON_SIZES  = { sm: 40, md: 60, lg: 80, xl: 120 };
  var V_NAME_SIZES  = { sm: '13px', md: '17px', lg: '21px', xl: '28px' };
  var V_SUB_SIZES   = { sm: '7.5px', md: '9px', lg: '10px', xl: '13px' };

  function LogoVertical(opts) {
    opts = opts || {};
    var sKey   = opts.size  || 'md';
    var colors = resolveColors(opts.color);
    var mark   = MARK_SVG({ size: V_ICON_SIZES[sKey] || 60, primary: colors.primary, accent: colors.accent });
    var pColor = colors.primary === 'currentColor' ? 'currentColor' : colors.primary;
    var aColor = colors.accent  === 'currentColor' ? 'currentColor' : colors.accent;
    var showSub = opts.showSubtext !== false;
    return (
      '<div class="tw-logo tw-logo-vertical tw-logo-' + sKey + '" style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none">' +
        mark +
        '<div class="tw-logo-text" style="text-align:center">' +
          '<div class="tw-logo-wordmark" style="font-family:Inter,system-ui,sans-serif;font-weight:900;font-size:' + V_NAME_SIZES[sKey] + ';letter-spacing:-0.3px;line-height:1;color:' + pColor + '">' +
            'Tensor<span style="color:' + aColor + '">Works</span>' +
          '</div>' +
          (showSub
            ? '<div class="tw-logo-sub" style="font-family:Inter,system-ui,sans-serif;font-size:' + V_SUB_SIZES[sKey] + ';font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;margin-top:4px">AI Hardware</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  /* ── Nav-specific inline SVG (matches site dark theme) ──────── */
  function NavLogo() {
    return (
      '<a href="/" class="logo" aria-label="TensorWorks home" style="display:flex;align-items:center;gap:10px;text-decoration:none">' +
        MARK_SVG({ size: 32, primary: '#1F5C99', accent: '#76B900' }) +
        '<span style="font-size:17px;font-weight:900;color:#fff;letter-spacing:-0.3px;font-family:Inter,system-ui,sans-serif">' +
          'Tensor<span style="color:#76B900">Works</span>' +
        '</span>' +
      '</a>'
    );
  }

  /* ── Inject CSS ─────────────────────────────────────────────── */
  function injectLogoStyles() {
    if (document.getElementById('tw-logo-styles')) return;
    var s = document.createElement('style');
    s.id  = 'tw-logo-styles';
    s.textContent = [
      ':root{--tw-logo-primary:#1F5C99;--tw-logo-accent:#76B900;--tw-logo-text:#333;--tw-logo-sub:#666}',
      '@media(prefers-color-scheme:dark){:root{--tw-logo-primary:#4A8FD9;--tw-logo-accent:#9FD700;--tw-logo-text:#fff;--tw-logo-sub:#aaa}}',
      '.tw-logo-mark{display:block;flex-shrink:0}',
      '.tw-logo-horizontal{display:flex;align-items:center}',
      '.tw-logo-vertical{display:inline-flex;flex-direction:column;align-items:center}',
      '@keyframes tw-logo-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.03)}}',
      '.tw-logo-animate{animation:tw-logo-pulse 2.4s ease-in-out 3}',
      '@keyframes tw-logo-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '.tw-logo-hero{animation:tw-logo-fadein .35s ease forwards}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Export ─────────────────────────────────────────────────── */
  injectLogoStyles();
  window.TW = window.TW || {};
  window.TW.Logo = { Mark: LogoMark, Horizontal: LogoHorizontal, Vertical: LogoVertical, NavLogo: NavLogo };

})();
