# Tab Duplicate Flagger

A Chrome extension (Manifest V3) that detects when the same page is already
open in another tab and lets you jump straight to it instead of duplicating it.

See [docs/tab-duplicate-flagger-spec.md](docs/tab-duplicate-flagger-spec.md) for the full spec.

## How it works

- Watches all open tabs across all windows (`chrome.tabs` events).
- Normalizes each tab's URL (`extension/urlNormalizer.js`):
  - Strips common tracking params (`utm_*`, `ref`, `fbclid`, `psc`, `th`, etc.)
  - Extracts stable site-specific IDs where possible (e.g. Amazon ASIN from `/dp/{ID}`, regardless of query string)
- Compares the normalized URL against all other currently open tabs.
- On a match: shows a Chrome notification and an in-page badge, both with a
  "switch to that tab" action that focuses the existing tab/window.

Everything is in-memory for the current browser session — no accounts, no
backend, no `history` permission.

## Load it locally

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select the `extension/` folder.
4. Open the same page (e.g. an Amazon product) in two tabs to see it in action.

## Files

```
extension/
  manifest.json       # MV3 config
  background.js       # service worker, watches tabs, does matching
  urlNormalizer.js     # strips tracking params, extracts site-specific IDs
  content.js           # in-page badge alongside the Chrome notification
  icons/               # 16/48/128 icons
```
