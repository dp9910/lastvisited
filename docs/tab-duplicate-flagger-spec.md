# Tab Duplicate Flagger (Chrome Extension, Mode A)

A Chrome extension (Manifest V3) that detects when the same page is open in more than one browser tab and notifies the user, so they can jump to the existing tab instead of duplicating it.

## Core Behavior

- Watch all open tabs across all windows.
- On every tab load/URL change, normalize the URL:
  - Strip tracking params (`utm_*`, `ref`, `fbclid`, `psc`, `th`, etc.)
  - Extract stable site-specific IDs where possible (e.g. Amazon ASIN from `/dp/{ID}` regardless of query string)
- Compare the normalized URL against all other currently open tabs.
- If a match is found, notify the user (Chrome notification or in-page badge) and let them jump directly to the existing tab.

## Constraints for v1

- No backend, no accounts, no database — pure client-side, in-memory per session.
- Only needs the `tabs` permission (not `history`) — keep the permission footprint minimal.
- No build tooling required — plain JS, loadable as an unpacked extension via `chrome://extensions` → Developer mode → Load unpacked.

## Expected Files

```
extension/
  manifest.json       # MV3 config
  background.js       # service worker, watches tabs, does matching
  urlNormalizer.js     # strips tracking params, extracts site-specific IDs
  content.js (optional) # in-page badge instead of/alongside Chrome notification
  icons/               # a few icon sizes
```

## Out of Scope for v1

- History-based "you visited this days ago" detection (Mode B) — possible v2 once v1 is validated. Would require the `history` permission and a decay-window setting (e.g. only flag visits within the last 14 days).
