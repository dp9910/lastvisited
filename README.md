# Last Visited

A Chrome extension (Manifest V3) that detects when the same page is already
open in another tab — or was visited recently — and lets you jump straight to
it instead of duplicating it.

See [docs/tab-duplicate-flagger-spec.md](docs/tab-duplicate-flagger-spec.md) for the original v1 spec.

## How it works

- Watches all open tabs across all windows (`chrome.tabs` events).
- Normalizes each tab's URL (`extension/urlNormalizer.js`):
  - Strips common tracking params (`utm_*`, `ref`, `fbclid`, `psc`, `th`, etc.)
  - Extracts stable site-specific IDs where possible (e.g. Amazon ASIN from `/dp/{ID}`, regardless of query string)
- **Open-tab duplicates**: compares the normalized URL against all other
  currently open tabs. On a match: a Chrome notification and an in-page badge
  show which tab has it open and since when, with a "switch to that tab" action.
- **Recent-visit duplicates**: if the page isn't open elsewhere, checks
  `chrome.history` for any prior visit to the same normalized URL — any page
  that's genuinely in your history, not bounded to a fixed number of days. On
  a match: a notification/badge shows when it was last visited and how many times.
- **Popup dashboard** (click the toolbar icon): lists every group of open
  duplicate tabs (with per-tab "opened X ago" and a Switch button) and the
  current tab's visit history. The toolbar icon also shows a badge count of
  open duplicate tabs.

Everything is session-scoped for open-tab tracking (kept in
`chrome.storage.session`, which — like a plain in-memory variable — is cleared
when the browser closes, but unlike one survives the service worker being
suspended mid-session); history lookups read directly from Chrome's own
history and nothing is stored by the extension itself. In incognito windows,
history-based matching is skipped entirely so a private tab never surfaces
regular-window browsing history.

## Load it locally

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select the `extension/` folder.
4. Open the same page (e.g. an Amazon product) in two tabs to see it in action,
   or revisit a page you've loaded before to see the history match.

Note: recent Chrome versions ignore the `--load-extension` command-line flag
for the stable build — "Load unpacked" via the UI above is the supported path.

## Files

```
extension/
  manifest.json       # MV3 config (tabs, notifications, scripting, history, storage)
  background.js       # service worker: watches tabs, matches duplicates, scans history
  urlNormalizer.js     # strips tracking params, extracts site-specific IDs
  timeFormat.js        # shared "X ago" time formatting
  content.js           # in-page badge alongside the Chrome notification
  popup.html/css/js    # toolbar popup dashboard
  icons/               # 16/48/128 icons
```
