importScripts('urlNormalizer.js', 'timeFormat.js');

const HISTORY_DECAY_DAYS = 7;
const HISTORY_DECAY_MS = HISTORY_DECAY_DAYS * 24 * 60 * 60 * 1000;
const IGNORE_RECENT_VISIT_MS = 60 * 1000; // don't match the visit chrome.history just logged for this navigation

// tabId -> { normalizedUrl, openedAt }. In-memory only, per the v1 spec.
// openedAt is when we first saw this tab at its current normalized URL; for
// tabs that were already open when the service worker (re)started, it's a
// best-effort stand-in (we have no way to recover their real open time).
const tabMeta = new Map();
const notificationMap = new Map(); // notificationId -> { type: 'duplicate', existingTabId } | { type: 'history' }

async function rebuildState() {
  tabMeta.clear();
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  for (const tab of tabs) {
    if (tab.id !== undefined && isTrackableUrl(tab.url)) {
      tabMeta.set(tab.id, { normalizedUrl: normalizeUrl(tab.url), openedAt: now });
    }
  }
  await updateBadge();
}

async function focusTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

async function findOpenDuplicateGroups() {
  const tabs = await chrome.tabs.query({});
  const groups = new Map(); // normalizedUrl -> tab[]
  for (const tab of tabs) {
    if (!isTrackableUrl(tab.url)) continue;
    const normalized = normalizeUrl(tab.url);
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(tab);
  }
  return [...groups.entries()]
    .filter(([, tabsInGroup]) => tabsInGroup.length > 1)
    .map(([normalizedUrl, tabsInGroup]) => ({
      normalizedUrl,
      tabs: tabsInGroup.map((tab) => ({
        tabId: tab.id,
        windowId: tab.windowId,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        openedAt: tabMeta.get(tab.id)?.openedAt ?? null,
      })),
    }));
}

async function updateBadge() {
  const groups = await findOpenDuplicateGroups();
  const extraTabCount = groups.reduce((sum, g) => sum + (g.tabs.length - 1), 0);
  await chrome.action.setBadgeText({ text: extraTabCount > 0 ? String(extraTabCount) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
}

async function injectBadge(tabId, message) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    // Injection can fail on restricted pages (Web Store, PDFs, etc.) — the
    // Chrome notification still covers the user in that case.
  }
}

async function notifyDuplicateTab(newTabId, existingTab) {
  const existingMeta = tabMeta.get(existingTab.id);
  const openedText = existingMeta ? formatRelativeTime(existingMeta.openedAt) : 'earlier this session';

  const notificationId = `dup-${newTabId}-${existingTab.id}-${Date.now()}`;
  notificationMap.set(notificationId, { type: 'duplicate', existingTabId: existingTab.id });

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'This page is already open',
    message: `${existingTab.title ? `"${existingTab.title}"` : 'It'} has been open in another tab since ${openedText}.`,
    buttons: [{ title: 'Switch to that tab' }],
    priority: 1,
  });

  await injectBadge(newTabId, {
    type: 'DUPLICATE_TAB_DETECTED',
    existingTabId: existingTab.id,
    openedText,
  });
}

async function notifyHistoryMatch(tabId, historyItem) {
  const visitedText = formatRelativeTime(historyItem.lastVisitTime);
  const visitCountText = historyItem.visitCount > 1 ? ` (visited ${historyItem.visitCount}×)` : '';

  const notificationId = `hist-${tabId}-${Date.now()}`;
  notificationMap.set(notificationId, { type: 'history' });

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: "You've visited this page before",
    message: `Last visited ${visitedText}${visitCountText}.`,
    priority: 0,
  });

  await injectBadge(tabId, {
    type: 'HISTORY_MATCH_DETECTED',
    visitedText,
    visitCountText,
  });
}

async function checkHistory(tabId, normalized, rawUrl) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch (e) {
    return;
  }

  const now = Date.now();
  const results = await chrome.history.search({
    text: hostname,
    startTime: now - HISTORY_DECAY_MS,
    maxResults: 100,
  }).catch(() => []);

  const match = results.find(
    (r) => r.lastVisitTime && now - r.lastVisitTime > IGNORE_RECENT_VISIT_MS && normalizeUrl(r.url) === normalized
  );

  if (match) await notifyHistoryMatch(tabId, match);
}

async function handleTabUrl(tabId, rawUrl) {
  if (!isTrackableUrl(rawUrl)) {
    tabMeta.delete(tabId);
    await updateBadge();
    return;
  }

  const normalized = normalizeUrl(rawUrl);
  const existingEntry = tabMeta.get(tabId);
  if (!existingEntry || existingEntry.normalizedUrl !== normalized) {
    tabMeta.set(tabId, { normalizedUrl: normalized, openedAt: Date.now() });
  }

  const allTabs = await chrome.tabs.query({});
  const duplicateTab = allTabs.find(
    (t) => t.id !== tabId && isTrackableUrl(t.url) && normalizeUrl(t.url) === normalized
  );

  if (duplicateTab) {
    await notifyDuplicateTab(tabId, duplicateTab);
  } else {
    await checkHistory(tabId, normalized, rawUrl);
  }

  await updateBadge();
}

chrome.runtime.onInstalled.addListener(rebuildState);
chrome.runtime.onStartup.addListener(rebuildState);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    handleTabUrl(tabId, changeInfo.url);
  } else if (changeInfo.status === 'complete' && tab.url) {
    handleTabUrl(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabMeta.delete(tabId);
  updateBadge();
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  tabMeta.delete(removedTabId);
  chrome.tabs.get(addedTabId).then((tab) => {
    if (tab && isTrackableUrl(tab.url)) handleTabUrl(addedTabId, tab.url);
  }).catch(() => {});
});

chrome.notifications.onButtonClicked.addListener((notificationId) => {
  const entry = notificationMap.get(notificationId);
  if (entry?.type === 'duplicate') focusTab(entry.existingTabId);
  chrome.notifications.clear(notificationId);
  notificationMap.delete(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const entry = notificationMap.get(notificationId);
  if (entry?.type === 'duplicate') focusTab(entry.existingTabId);
  chrome.notifications.clear(notificationId);
  notificationMap.delete(notificationId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FOCUS_TAB' && typeof message.tabId === 'number') {
    focusTab(message.tabId);
    return false;
  }
  if (message?.type === 'GET_OPEN_DUPLICATES') {
    findOpenDuplicateGroups().then((dupGroups) => sendResponse({ dupGroups }));
    return true; // async sendResponse
  }
  return false;
});
