# Privacy Policy — Last Visited

**Last updated:** 2026-07-11

Last Visited is a Chrome extension that helps you notice when a page is
already open in another tab, or when you visited it recently, so you can jump
to the existing tab instead of opening a duplicate.

## Data collection

Last Visited does not collect, transmit, sell, or store any data anywhere.

- There is no backend server, no analytics, no account, no sign-in.
- Nothing the extension reads (tab URLs/titles, browsing history) ever leaves
  your device. All processing happens locally in the browser.
- Nothing is written to disk by the extension. Open-tab tracking lives in
  `chrome.storage.session`, which Chrome clears automatically when the
  browser closes.

## What the extension reads, and why

| Data | Why it's needed | Where it goes |
|---|---|---|
| Open tabs' URLs and titles (`tabs` permission) | To detect when the same page is open in more than one tab | Compared in memory on your device only |
| Browsing history from the last 7 days (`history` permission) | To detect when you revisited a page you visited recently | Read locally to compare against the current tab; never copied, stored, or sent anywhere |
| Notifications (`notifications` permission) | To show a system notification when a duplicate/recent visit is found | Local OS notification only |
| Script injection into the current page (`scripting` + host permissions) | To show a small on-page badge alongside the notification | Runs only in your browser, on the page you're already viewing |
| Session storage (`storage` permission) | To remember when each open tab was first seen, so "opened X ago" survives the browser's background service worker restarting | Local to your browser session; cleared on browser close |

## Incognito

History-based matching is skipped entirely for incognito tabs, so a private
window never surfaces your regular browsing history.

## Changes to this policy

If this policy changes, the updated version will be posted in this file in
the extension's repository.

## Contact

Questions about this extension's privacy practices can be directed to the
developer via the Chrome Web Store listing's support contact.
