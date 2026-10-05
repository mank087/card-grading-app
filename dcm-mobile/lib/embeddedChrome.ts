export const inAppChromeInjection = `
    (function() {
      if (![new URL("https://dcmgrading.com").origin, 'https://dcmgrading.com', 'https://www.dcmgrading.com'].includes(location.origin)) return;
      if (window.__dcmInAppHideInstalled) {
        // Re-entry after a full page load in the same WebView: make sure the
        // rule still reflects the current document.
        if (window.__dcmInAppApplyChrome) { window.__dcmInAppApplyChrome(); }
        return;
      }
      window.__dcmInAppHideInstalled = true;

      var SHARED = [
        'main { padding-top: 16px !important; }',
        // Explicitly-marked global chrome (new web contract).
        '[data-site-chrome] { display: none !important; }',
        // HelpBot floating button (fixed bottom-right, high z-index)
        '.fixed.bottom-6.right-6 { display: none !important; }',
        '[class*="fixed"][class*="bottom-6"][class*="right-6"] { display: none !important; }',
        // Site-wide "Download the app" launch banner — redundant in-app.
        // Selector is set on src/components/LaunchBanner.tsx (web).
        '[data-dcm-launch-banner] { display: none !important; }',
      ];
      // Legacy blanket rule. Applied ONLY when the page does not advertise
      // the data-embedded contract.
      var LEGACY = 'header, nav, footer { display: none !important; }';

      var style = document.createElement('style');
      style.id = '__dcm-in-app-hide';
      (document.head || document.documentElement).appendChild(style);

      var lastMode = null;
      function applyChrome() {
        var docEl = document.documentElement;
        var embedded = docEl && docEl.getAttribute('data-embedded') === '1';
        var mode = embedded ? 'marked' : 'legacy';
        if (mode === lastMode) { return; }
        lastMode = mode;
        var rules = SHARED.slice();
        if (!embedded) { rules.unshift(LEGACY); }
        style.textContent = rules.join('\\n');
      }
      window.__dcmInAppApplyChrome = applyChrome;
      applyChrome();

      // Belt-and-suspenders: anything HelpBot-shaped that escapes the
      // class selectors gets hidden by computed-style sweep. Never sweeps
      // non-fixed content, so it cannot hide page copy.
      //
      // Opt-out: the web side marks real fixed-position UI that must survive
      // in the app (the package-artwork lightbox on /credits, /vip and
      // /card-lovers) with \`data-dcm-keep\`. That overlay is inset:0 with
      // z-index 1000, so bottom/right are both 0 and it matched the HelpBot
      // shape exactly — it used to be hidden the instant it opened. Anything
      // carrying the attribute, or inside something that does, is skipped.
      function sweepFloating() {
        document.querySelectorAll('.fixed').forEach(function(el) {
          if (el.closest && el.closest('[data-dcm-keep]')) { return; }
          var s = window.getComputedStyle(el);
          if (s.position === 'fixed'
              && parseInt(s.bottom) < 50
              && parseInt(s.right) < 50
              && parseInt(s.zIndex) >= 40) {
            el.style.display = 'none';
          }
        });
      }
      sweepFloating();

      // Watch for DOM changes (Next.js client-side route transitions swap
      // out the page tree, and the embedded flag can be stamped late) and
      // re-run both the chrome decision and the floating-element sweep.
      var obs = new MutationObserver(function() {
        applyChrome();
        sweepFloating();
      });
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-embedded'],
      });
    })();
    true;
  `
