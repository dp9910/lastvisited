const HISTORY_DECAY_DAYS = 7;
const HISTORY_DECAY_MS = HISTORY_DECAY_DAYS * 24 * 60 * 60 * 1000;

const duplicatesEl = document.getElementById('duplicates');
const historyEl = document.getElementById('history');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderDuplicateGroups(groups) {
  duplicatesEl.textContent = '';

  if (!groups.length) {
    duplicatesEl.appendChild(el('p', 'empty-state', 'No duplicate tabs open right now.'));
    return;
  }

  for (const group of groups) {
    const card = el('div', 'dup-group');

    const titleRow = el('div', 'dup-group-title');
    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = group.tabs[0].favIconUrl || 'icons/icon16.png';
    favicon.addEventListener('error', () => { favicon.style.visibility = 'hidden'; });
    titleRow.appendChild(favicon);
    titleRow.appendChild(el('span', null, group.tabs[0].title || group.normalizedUrl));
    titleRow.appendChild(el('span', 'badge-count', String(group.tabs.length)));
    card.appendChild(titleRow);

    card.appendChild(el('div', 'dup-group-url', group.normalizedUrl));

    const sortedTabs = [...group.tabs].sort((a, b) => (a.openedAt ?? 0) - (b.openedAt ?? 0));
    for (const tab of sortedTabs) {
      const row = el('div', 'dup-tab-row');
      const openedMeta = tab.openedAt
        ? `Opened ${formatRelativeTime(tab.openedAt)} · ${formatAbsoluteTime(tab.openedAt)}`
        : 'Opened earlier this session';
      row.appendChild(el('span', 'dup-tab-meta', openedMeta));
      const btn = el('button', 'switch-btn', 'Switch');
      btn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: tab.tabId });
        window.close();
      });
      row.appendChild(btn);
      card.appendChild(row);
    }

    duplicatesEl.appendChild(card);
  }
}

function renderHistoryMatches(matches) {
  historyEl.textContent = '';

  if (!matches.length) {
    historyEl.appendChild(el('p', 'empty-state', 'No recent visits found for this page.'));
    return;
  }

  for (const item of matches) {
    const row = el('div', 'history-row');
    const left = document.createElement('div');
    left.appendChild(el('div', 'history-when', `${formatRelativeTime(item.lastVisitTime)} · ${formatAbsoluteTime(item.lastVisitTime)}`));
    left.appendChild(el('div', 'dup-group-url', item.url));
    row.appendChild(left);
    row.appendChild(el('span', 'history-count', item.visitCount > 1 ? `${item.visitCount}×` : ''));
    historyEl.appendChild(row);
  }
}

async function loadDuplicates() {
  try {
    const { dupGroups } = await chrome.runtime.sendMessage({ type: 'GET_OPEN_DUPLICATES' });
    renderDuplicateGroups(dupGroups || []);
  } catch (e) {
    duplicatesEl.textContent = '';
    duplicatesEl.appendChild(el('p', 'empty-state', 'Could not load open tabs.'));
  }
}

async function loadHistoryForActiveTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab || !isTrackableUrl(activeTab.url)) {
    historyEl.textContent = '';
    historyEl.appendChild(el('p', 'empty-state', 'This page cannot be checked against history.'));
    return;
  }

  const normalized = normalizeUrl(activeTab.url);
  const hostname = new URL(activeTab.url).hostname;

  const results = await chrome.history.search({
    text: hostname,
    startTime: Date.now() - HISTORY_DECAY_MS,
    maxResults: 100,
  });

  const matches = results
    .filter((r) => normalizeUrl(r.url) === normalized)
    .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
    .slice(0, 10);

  renderHistoryMatches(matches);
}

loadDuplicates();
loadHistoryForActiveTab();
