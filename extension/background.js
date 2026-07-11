importScripts('urlNormalizer.js', 'timeFormat.js');

const HISTORY_DECAY_DAYS = 7;
const IGNORE_RECENT_VISIT_MS = 60 * 1000; // don't match the visit chrome.history just logged for this navigation
const TAB_META_KEY = 'tabMeta';

// Start of day, N days ago — not "now minus N*24h". A strict rolling window
// would exclude a visit from earlier today N days ago (e.g. checking at 2pm
// excludes a visit from before 2pm that day), which doesn't match how users
// think of "I visited this N days ago": the whole calendar day should count.
function getHistoryStartTime() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday.getTime() - HISTORY_DECAY_DAYS * 24 * 60 * 60 * 1000;
}

// tabId -> { normalizedUrl, openedAt }, kept in chrome.storage.session rather
// than a plain JS Map: MV3 service workers are torn down after ~30s idle and
// any in-memory state is lost on the next wake-up, which made "opened X ago"
// silently reset mid-session. storage.session survives worker restarts but
// (like an in-memory Map) is still cleared when the browser itself closes.

async function getTabMeta() {
  const stored = await chrome.storage.session.get(TAB_META_KEY);
  return stored[TAB_META_KEY] || {};
}

async function setTabMetaEntry(tabId, entry) {
  const meta = await getTabMeta();
  meta[tabId] = entry;
  await chrome.storage.session.set({ [TAB_META_KEY]: meta });
}

async function deleteTabMetaEntry(tabId) {
  const meta = await getTabMeta();
  delete meta[tabId];
  await chrome.storage.session.set({ [TAB_META_KEY]: meta });
}

async function rebuildState() {
  const meta = await getTabMeta();
  const tabs = await chrome.tabs.query({});
  const liveTabIds = new Set(tabs.map((t) => String(t.id)));
  const now = Date.now();

  for (const tab of tabs) {
    if (tab.id !== undefined && isTrackableUrl(tab.url) && !(tab.id in meta)) {
      meta[tab.id] = { normalizedUrl: normalizeUrl(tab.url), openedAt: now };
    }
  }
  for (const tabId of Object.keys(meta)) {
    if (!liveTabIds.has(tabId)) delete meta[tabId];
  }

  await chrome.storage.session.set({ [TAB_META_KEY]: meta });
  await updateBadge();
}

async function focusTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

async function findOpenDuplicateGroups() {
  const [tabs, meta] = await Promise.all([chrome.tabs.query({}), getTabMeta()]);
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
        openedAt: meta[tab.id]?.openedAt ?? null,
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
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, message);
      return;
    } catch (e) {
      if (attempt === 0) {
        // The content script may not have finished registering its listener
        // yet on a still-loading page — wait once and retry before giving up.
        await new Promise((r) => setTimeout(r, 400));
      } else {
        console.error('[TabDuplicateFlagger] injectBadge failed', tabId, e);
      }
    }
  }
}

async function notifyDuplicateTab(newTabId, existingTab) {
  const meta = await getTabMeta();
  const existingMeta = meta[existingTab.id];
  const openedText = existingMeta ? formatRelativeTime(existingMeta.openedAt) : 'earlier this session';
  const openedAbsolute = existingMeta ? formatAbsoluteTime(existingMeta.openedAt) : null;

  const notificationId = `dup-${existingTab.id}-${Date.now()}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'This page is already open',
    message: `${existingTab.title ? `"${existingTab.title}"` : 'It'} has been open in another tab since ${openedText}${openedAbsolute ? ` (${openedAbsolute})` : ''}.`,
    buttons: [{ title: 'Switch to that tab' }],
    priority: 1,
  });

  await injectBadge(newTabId, {
    type: 'DUPLICATE_TAB_DETECTED',
    existingTabId: existingTab.id,
    openedText,
    openedAbsolute,
  });
}

async function notifyHistoryMatch(tabId, historyItem) {
  const visitedText = formatRelativeTime(historyItem.lastVisitTime);
  const visitedAbsolute = formatAbsoluteTime(historyItem.lastVisitTime);
  const visitCountText = historyItem.visitCount > 1 ? ` (visited ${historyItem.visitCount}×)` : '';

  const notificationId = `hist-${Date.now()}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: "You've visited this page before",
    message: `Last visited ${visitedText} (${visitedAbsolute})${visitCountText}.`,
    priority: 0,
  });

  await injectBadge(tabId, {
    type: 'HISTORY_MATCH_DETECTED',
    visitedText,
    visitedAbsolute,
    visitCountText,
  });
}

async function checkHistory(tabId, normalized, rawUrl) {
  let hostname;
  try {
    // Strip www. so this is a substring of a stored history entry regardless
    // of which variant it was visited under — many sites (this includes a
    // lot of .edu/.gov sites) serve the identical page on both www.example.com
    // and example.com with no redirect, so a raw hostname would only match
    // history in one direction (e.g. "www.example.com" is not a substring of
    // a stored "example.com/..." URL, even though normalizeUrl treats them
    // as the same page).
    hostname = new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch (e) {
    return;
  }
  if (!hostname) return; // e.g. file:// URLs — no meaningful text to search history with

  const now = Date.now();
  const results = await chrome.history.search({
    text: hostname,
    startTime: getHistoryStartTime(),
    maxResults: 100,
  }).catch(() => []);

  const match = results.find(
    (r) => r.lastVisitTime && now - r.lastVisitTime > IGNORE_RECENT_VISIT_MS && normalizeUrl(r.url) === normalized
  );

  if (match) await notifyHistoryMatch(tabId, match);
}

async function handleTabUrl(tabId, rawUrl, incognito) {
  if (!isTrackableUrl(rawUrl)) {
    await deleteTabMetaEntry(tabId);
    await updateBadge();
    return;
  }

  const normalized = normalizeUrl(rawUrl);
  const meta = await getTabMeta();
  const existingEntry = meta[tabId];
  if (!existingEntry || existingEntry.normalizedUrl !== normalized) {
    await setTabMetaEntry(tabId, { normalizedUrl: normalized, openedAt: Date.now() });
  }

  const allTabs = await chrome.tabs.query({});
  const duplicateTab = allTabs.find(
    (t) => t.id !== tabId && isTrackableUrl(t.url) && normalizeUrl(t.url) === normalized
  );

  if (duplicateTab) {
    await notifyDuplicateTab(tabId, duplicateTab);
  } else if (!incognito) {
    // chrome.history never records incognito browsing, but it would still
    // surface *regular* browsing history inside a private window — skip it
    // there so an incognito tab never surfaces non-incognito history.
    await checkHistory(tabId, normalized, rawUrl);
  }

  await updateBadge();
}

// tabId -> normalizedUrl last handled, so a single navigation that fires
// multiple onUpdated events (loading + complete) doesn't trigger duplicate
// notifications/badges twice. Fine to keep in-memory: worst case after a
// worker restart is one redundant check, not a missed or repeated user-facing
// notification storm.
const lastHandledUrl = new Map();

function maybeHandleTabUrl(tabId, rawUrl, incognito) {
  if (!rawUrl) return;
  const normalized = isTrackableUrl(rawUrl) ? normalizeUrl(rawUrl) : rawUrl;
  if (lastHandledUrl.get(tabId) === normalized) return;
  lastHandledUrl.set(tabId, normalized);
  handleTabUrl(tabId, rawUrl, incognito);
}

chrome.runtime.onInstalled.addListener(rebuildState);
chrome.runtime.onStartup.addListener(rebuildState);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    maybeHandleTabUrl(tabId, changeInfo.url, tab.incognito);
  } else if (changeInfo.status === 'complete' && tab.url) {
    maybeHandleTabUrl(tabId, tab.url, tab.incognito);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastHandledUrl.delete(tabId);
  deleteTabMetaEntry(tabId).then(updateBadge);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  lastHandledUrl.delete(removedTabId);
  deleteTabMetaEntry(removedTabId);
  chrome.tabs.get(addedTabId).then((tab) => {
    if (tab && isTrackableUrl(tab.url)) maybeHandleTabUrl(addedTabId, tab.url, tab.incognito);
  }).catch(() => {});
});

function parseNotificationId(notificationId) {
  const [type, arg] = notificationId.split('-');
  if (type === 'dup') return { type: 'duplicate', existingTabId: Number(arg) };
  if (type === 'hist') return { type: 'history' };
  return null;
}

chrome.notifications.onButtonClicked.addListener((notificationId) => {
  const entry = parseNotificationId(notificationId);
  if (entry?.type === 'duplicate') focusTab(entry.existingTabId);
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const entry = parseNotificationId(notificationId);
  if (entry?.type === 'duplicate') focusTab(entry.existingTabId);
  chrome.notifications.clear(notificationId);
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
