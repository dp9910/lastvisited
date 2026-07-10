importScripts('urlNormalizer.js');

// In-memory only, per the v1 spec — no persistence across browser restarts.
const tabUrlMap = new Map(); // tabId -> normalizedUrl
const notificationMap = new Map(); // notificationId -> { existingTabId, newTabId }

const SKIPPED_SCHEMES = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'devtools://'];

function isSkippable(url) {
  return !url || SKIPPED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

async function rebuildState() {
  tabUrlMap.clear();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined && !isSkippable(tab.url)) {
      tabUrlMap.set(tab.id, normalizeUrl(tab.url));
    }
  }
}

async function focusTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

async function notifyDuplicate(newTabId, existingTabId, existingTab) {
  const notificationId = `dup-${newTabId}-${existingTabId}-${Date.now()}`;
  notificationMap.set(notificationId, { existingTabId, newTabId });

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'This page is already open',
    message: existingTab.title ? `Already open in tab: "${existingTab.title}"` : 'It is already open in another tab.',
    buttons: [{ title: 'Switch to that tab' }],
    priority: 1,
  });

  try {
    await chrome.scripting.executeScript({ target: { tabId: newTabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(newTabId, { type: 'DUPLICATE_TAB_DETECTED', existingTabId });
  } catch (e) {
    // Injection can fail on restricted pages (Web Store, PDFs, etc.) — the
    // Chrome notification above still covers the user in that case.
  }
}

async function handleTabUrl(tabId, rawUrl) {
  if (isSkippable(rawUrl)) {
    tabUrlMap.delete(tabId);
    return;
  }

  const normalized = normalizeUrl(rawUrl);
  tabUrlMap.set(tabId, normalized);

  for (const [otherId, otherUrl] of tabUrlMap.entries()) {
    if (otherId === tabId || otherUrl !== normalized) continue;

    const existingTab = await chrome.tabs.get(otherId).catch(() => null);
    if (!existingTab) {
      tabUrlMap.delete(otherId); // stale entry, tab no longer exists
      continue;
    }

    await notifyDuplicate(tabId, otherId, existingTab);
    break;
  }
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
  tabUrlMap.delete(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  tabUrlMap.delete(removedTabId);
  chrome.tabs.get(addedTabId).then((tab) => {
    if (tab && !isSkippable(tab.url)) handleTabUrl(addedTabId, tab.url);
  }).catch(() => {});
});

chrome.notifications.onButtonClicked.addListener((notificationId) => {
  const entry = notificationMap.get(notificationId);
  if (entry) focusTab(entry.existingTabId);
  chrome.notifications.clear(notificationId);
  notificationMap.delete(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const entry = notificationMap.get(notificationId);
  if (entry) focusTab(entry.existingTabId);
  chrome.notifications.clear(notificationId);
  notificationMap.delete(notificationId);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'FOCUS_TAB' && typeof message.tabId === 'number') {
    focusTab(message.tabId);
  }
});
