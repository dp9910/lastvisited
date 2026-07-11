// Optional in-page badge shown alongside the Chrome notification when this
// tab is a duplicate of one already open elsewhere, or matches recent history.
(function () {
  if (window.__tabDuplicateFlaggerInjected) return;
  window.__tabDuplicateFlaggerInjected = true;

  const STYLE_ID = 'tab-duplicate-flagger-style';
  const BADGE_ID = 'tab-duplicate-flagger-badge';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BADGE_ID} {
        all: initial;
        position: fixed; top: 16px; right: 16px; z-index: 2147483647;
        display: flex; align-items: flex-start; gap: 16px;
        padding: 16px 20px; border-radius: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.22);
        min-width: 280px; max-width: 420px;
        background: #ffffff; border: 1px solid #e8eaed;
      }
      #${BADGE_ID} * { box-sizing: border-box; font-family: inherit; }
      #${BADGE_ID} .tdf-title {
        font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; color: #5f6368; margin: 0 0 6px;
      }
      #${BADGE_ID} .tdf-datetime {
        font-size: 20px; font-weight: 700; color: #1a73e8; line-height: 1.2; margin: 0;
      }
      #${BADGE_ID} .tdf-sub {
        font-size: 12.5px; color: #5f6368; margin: 6px 0 0;
      }
      #${BADGE_ID} .tdf-button {
        background: #1a73e8; color: #fff; border: none; border-radius: 6px;
        padding: 7px 14px; font-weight: 600; font-size: 13px; cursor: pointer;
        flex-shrink: 0; margin-top: 4px;
      }
      #${BADGE_ID} .tdf-button:hover { filter: brightness(1.1); }
      #${BADGE_ID} .tdf-close {
        cursor: pointer; opacity: 0.5; font-size: 20px; line-height: 1;
        flex-shrink: 0; color: #5f6368;
      }
      #${BADGE_ID} .tdf-close:hover { opacity: 0.9; }
      #${BADGE_ID} .tdf-body { flex: 1; min-width: 0; }
      @media (prefers-color-scheme: dark) {
        #${BADGE_ID} { background: #2a2b2e; border-color: #3c4043; }
        #${BADGE_ID} .tdf-title { color: #9aa0a6; }
        #${BADGE_ID} .tdf-datetime { color: #8ab4f8; }
        #${BADGE_ID} .tdf-sub { color: #9aa0a6; }
        #${BADGE_ID} .tdf-close { color: #9aa0a6; }
        #${BADGE_ID} .tdf-button { background: #8ab4f8; color: #202124; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'DUPLICATE_TAB_DETECTED') {
      showBadge({
        datetime: message.openedAbsolute || message.openedText,
        sub: `${message.openedText} · still open in another tab`,
        buttonLabel: 'Switch to that tab',
        onAction: () => chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: message.existingTabId }),
      });
    } else if (message?.type === 'HISTORY_MATCH_DETECTED') {
      showBadge({
        datetime: message.visitedAbsolute,
        sub: `${message.visitedText}${message.visitCountText}`,
        buttonLabel: null,
      });
    }
  });

  function showBadge({ datetime, sub, buttonLabel, onAction }) {
    ensureStyle();

    const existing = document.getElementById(BADGE_ID);
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = BADGE_ID;

    const body = document.createElement('div');
    body.className = 'tdf-body';

    const title = document.createElement('p');
    title.className = 'tdf-title';
    title.textContent = 'Last Visited';
    body.appendChild(title);

    const datetimeEl = document.createElement('p');
    datetimeEl.className = 'tdf-datetime';
    datetimeEl.textContent = datetime;
    body.appendChild(datetimeEl);

    const subEl = document.createElement('p');
    subEl.className = 'tdf-sub';
    subEl.textContent = sub;
    body.appendChild(subEl);

    if (buttonLabel) {
      const button = document.createElement('button');
      button.className = 'tdf-button';
      button.textContent = buttonLabel;
      button.addEventListener('click', () => {
        onAction?.();
        badge.remove();
      });
      body.appendChild(button);
    }

    badge.appendChild(body);

    const close = document.createElement('span');
    close.className = 'tdf-close';
    close.textContent = '×';
    close.addEventListener('click', () => badge.remove());
    badge.appendChild(close);

    document.documentElement.appendChild(badge);
    setTimeout(() => badge.remove(), 15000);
  }
})();
