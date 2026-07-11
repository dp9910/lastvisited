const HISTORY_DECAY_DAYS = 7;
const IGNORE_RECENT_VISIT_MS = 60 * 1000; // matches background.js — excludes the current page view itself

// Start of day, N days ago — see the matching comment in background.js for
// why this isn't a strict "now minus N*24h" rolling window.
function getHistoryStartTime() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday.getTime() - HISTORY_DECAY_DAYS * 24 * 60 * 60 * 1000;
}

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

function renderHistoryMatches(visitTimes) {
  historyEl.textContent = '';

  if (!visitTimes.length) {
    historyEl.appendChild(el('p', 'empty-state', 'No recent visits found for this page.'));
    return;
  }

  for (const visitTime of visitTimes) {
    const row = el('div', 'history-row');
    row.appendChild(el('div', 'history-when', `${formatRelativeTime(visitTime)} · ${formatAbsoluteTime(visitTime)}`));
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
  // Strip www. so this matches a stored history entry regardless of which
  // variant it was visited under — see the comment in background.js's
  // checkHistory for why (e.g. many .edu/.gov sites serve both identically).
  const hostname = new URL(activeTab.url).hostname.replace(/^www\./, '');

  const results = await chrome.history.search({
    text: hostname,
    startTime: getHistoryStartTime(),
    maxResults: 100,
  });

  // chrome.history.search only exposes each URL's aggregated lastVisitTime
  // (the single most recent visit), which — since we're checking the page
  // you're on right now — is always this exact visit. Pull the full
  // per-visit timestamps instead and exclude the one(s) from just now, so
  // this shows genuine prior visits rather than nothing at all.
  const matchingEntries = results.filter((r) => normalizeUrl(r.url) === normalized);
  const visitLists = await Promise.all(
    matchingEntries.map((r) => chrome.history.getVisits({ url: r.url }).catch(() => []))
  );
  const now = Date.now();
  const priorVisitTimes = visitLists
    .flat()
    .map((v) => v.visitTime)
    .filter((t) => t && now - t > IGNORE_RECENT_VISIT_MS)
    .sort((a, b) => b - a)
    .slice(0, 10);

  renderHistoryMatches(priorVisitTimes);
}

loadDuplicates();
loadHistoryForActiveTab();
