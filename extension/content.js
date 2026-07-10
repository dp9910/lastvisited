// Optional in-page badge shown alongside the Chrome notification when this
// tab is a duplicate of one already open elsewhere, or matches recent history.
(function () {
  if (window.__tabDuplicateFlaggerInjected) return;
  window.__tabDuplicateFlaggerInjected = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'DUPLICATE_TAB_DETECTED') {
      showBadge({
        title: 'Already open in another tab',
        detail: `Opened ${message.openedText}${message.openedAbsolute ? ` · ${message.openedAbsolute}` : ''}`,
        buttonLabel: 'Switch',
        onAction: () => chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: message.existingTabId }),
      });
    } else if (message?.type === 'HISTORY_MATCH_DETECTED') {
      showBadge({
        title: 'Visited before',
        detail: `${message.visitedText} · ${message.visitedAbsolute}${message.visitCountText}`,
        buttonLabel: null,
      });
    }
  });

  function showBadge({ title, detail, buttonLabel, onAction }) {
    const existing = document.getElementById('tab-duplicate-flagger-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = 'tab-duplicate-flagger-badge';
    badge.style.cssText = [
      'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
      'background:#202124', 'color:#fff', 'font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif',
      'padding:10px 14px', 'border-radius:8px', 'box-shadow:0 2px 10px rgba(0,0,0,0.3)',
      'display:flex', 'align-items:center', 'gap:12px', 'max-width:360px',
    ].join(';');

    const textEl = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-weight:600;';
    const detailEl = document.createElement('div');
    detailEl.textContent = detail;
    detailEl.style.cssText = 'color:#bdc1c6;font-size:12px;margin-top:2px;';
    textEl.appendChild(titleEl);
    textEl.appendChild(detailEl);
    badge.appendChild(textEl);

    if (buttonLabel) {
      const button = document.createElement('button');
      button.textContent = buttonLabel;
      button.style.cssText = [
        'background:#8ab4f8', 'color:#202124', 'border:none', 'border-radius:4px',
        'padding:4px 10px', 'font-weight:600', 'cursor:pointer', 'flex-shrink:0',
      ].join(';');
      button.addEventListener('click', () => {
        onAction?.();
        badge.remove();
      });
      badge.appendChild(button);
    }

    const close = document.createElement('span');
    close.textContent = '×';
    close.style.cssText = 'cursor:pointer;opacity:0.7;font-size:16px;flex-shrink:0;';
    close.addEventListener('click', () => badge.remove());
    badge.appendChild(close);

    document.documentElement.appendChild(badge);
    setTimeout(() => badge.remove(), 15000);
  }
})();
