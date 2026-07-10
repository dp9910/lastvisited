// Optional in-page badge shown alongside the Chrome notification when this
// tab is a duplicate of one already open elsewhere.
(function () {
  if (window.__tabDuplicateFlaggerInjected) return;
  window.__tabDuplicateFlaggerInjected = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'DUPLICATE_TAB_DETECTED') {
      showBadge(message.existingTabId);
    }
  });

  function showBadge(existingTabId) {
    const existing = document.getElementById('tab-duplicate-flagger-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = 'tab-duplicate-flagger-badge';
    badge.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
      'background:#202124', 'color:#fff', 'font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif',
      'padding:10px 14px', 'border-radius:8px', 'box-shadow:0 2px 10px rgba(0,0,0,0.3)',
      'display:flex', 'align-items:center', 'gap:10px',
    ].join(';');

    const text = document.createElement('span');
    text.textContent = 'Already open in another tab';
    badge.appendChild(text);

    const button = document.createElement('button');
    button.textContent = 'Switch';
    button.style.cssText = [
      'background:#8ab4f8', 'color:#202124', 'border:none', 'border-radius:4px',
      'padding:4px 10px', 'font-weight:600', 'cursor:pointer',
    ].join(';');
    button.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: existingTabId });
      badge.remove();
    });
    badge.appendChild(button);

    const close = document.createElement('span');
    close.textContent = '×';
    close.style.cssText = 'cursor:pointer;opacity:0.7;font-size:16px;';
    close.addEventListener('click', () => badge.remove());
    badge.appendChild(close);

    document.documentElement.appendChild(badge);
    setTimeout(() => badge.remove(), 10000);
  }
})();
