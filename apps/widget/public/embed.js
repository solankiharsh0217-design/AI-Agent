(function() {
  if (typeof window === 'undefined') return;

  var scriptTag = document.currentScript;
  if (!scriptTag) {
    var scripts = document.querySelectorAll('script[data-widget-id]');
    scriptTag = scripts[scripts.length - 1];
  }
  if (!scriptTag) return;

  var widgetId = scriptTag.getAttribute('data-widget-id');
  var apiUrl = scriptTag.getAttribute('data-api-url');

  if (!widgetId || !apiUrl) {
    console.error('[AI Agent Widget] data-widget-id and data-api-url are required');
    return;
  }

  // W9: Fetch widget config to apply theme
  var primaryColor = '#3B82F6';
  // W23: Robust WIDGET_URL for subpath deployments - use origin + pathname up to embed.js
  var scriptSrc = scriptTag.src || '';
  var WIDGET_URL = '';
  try {
    var url = new URL(scriptSrc, window.location.href);
    WIDGET_URL = url.origin + url.pathname.replace(/\/embed\.js.*$/, '');
  } catch {
    // Fallback: use string replacement
    WIDGET_URL = scriptSrc.replace(/\/embed\.js.*$/, '');
  }

  // Pre-fetch config for theme
  fetch(apiUrl + '/api/widgets/' + widgetId)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.data && data.data.config && data.data.config.theme && data.data.config.theme.primaryColor) {
        primaryColor = data.data.config.theme.primaryColor;
        applyTheme(primaryColor);
      }
    })
    .catch(function() {
      // Use default color
    });

  function applyTheme(color) {
    var toggleBtn = document.getElementById('ai-agent-widget-toggle');
    if (toggleBtn) {
      toggleBtn.style.background = color;
    }
  }

  var isOpen = false;
  var container = document.createElement('div');
  container.id = 'ai-agent-widget-container';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';

  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'ai-agent-widget-toggle';
  toggleBtn.style.cssText = 'width:60px;height:60px;border-radius:50%;background:' + primaryColor + ';color:white;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
  toggleBtn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  toggleBtn.setAttribute('role', 'button');
  toggleBtn.setAttribute('aria-label', 'Open chat');
  toggleBtn.setAttribute('tabindex', '0');
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', 'ai-agent-widget-iframe');

  var iframe = document.createElement('iframe');
  iframe.id = 'ai-agent-widget-iframe';
  iframe.style.cssText = 'display:none;position:fixed;bottom:90px;right:20px;width:400px;height:600px;border:none;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.15);z-index:999998;transition:opacity 0.2s;';
  iframe.allow = 'clipboard-write';
  iframe.title = 'AI Agent Chat';

  container.appendChild(iframe);
  container.appendChild(toggleBtn);
  document.body.appendChild(container);

  var loaded = false;

  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.display = 'block';
      iframe.style.opacity = '0';
      requestAnimationFrame(function() { iframe.style.opacity = '1'; });
      if (!loaded) {
        iframe.src = WIDGET_URL + '/?widgetId=' + encodeURIComponent(widgetId) + '&apiUrl=' + encodeURIComponent(apiUrl);
        loaded = true;
      }
      toggleBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      toggleBtn.style.transform = 'scale(1.1)';
      toggleBtn.setAttribute('aria-label', 'Close chat');
      toggleBtn.setAttribute('aria-expanded', 'true');
      // Focus management: focus the iframe when opened
      setTimeout(function() { iframe.focus(); }, 300);
    } else {
      iframe.style.opacity = '0';
      setTimeout(function() { iframe.style.display = 'none'; }, 200);
      toggleBtn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      toggleBtn.style.transform = 'scale(1)';
      toggleBtn.setAttribute('aria-label', 'Open chat');
      toggleBtn.setAttribute('aria-expanded', 'false');
      // Return focus to toggle button when closed
      toggleBtn.focus();
    }
  }

  // W10: Fix hover behavior - different transform for open/closed
  toggleBtn.addEventListener('mouseenter', function() {
    toggleBtn.style.transform = isOpen ? 'scale(1.15)' : 'scale(1.1)';
  });
  toggleBtn.addEventListener('mouseleave', function() {
    toggleBtn.style.transform = isOpen ? 'scale(1.1)' : 'scale(1)';
  });

  // Accessibility: keyboard support
  toggleBtn.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleWidget();
    }
  });

  toggleBtn.addEventListener('click', toggleWidget);
})();
