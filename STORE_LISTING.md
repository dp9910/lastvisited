# Chrome Web Store listing draft — Last Visited

Copy/paste source for the Developer Dashboard listing. Nothing here is
submitted automatically — use this as the text to paste into each field.

## Short description (132 char max)

```
Avoid duplicate tabs: get notified when a page is already open elsewhere or you visited it recently, and jump straight there.
```
(125 characters)

## Full description

```
Ever end up with the same product page, the same doc, the same article open
in three different tabs because you forgot you already had it open? Last
Visited catches that before you add tab #4 — so you stop hunting through
tabs for the one you already had, and never lose your place re-reading
something you saw last week.

WHAT IT DOES
The moment you open a page that's already sitting in another tab, you get a
notification and a small on-page badge — with exactly when that other tab
was opened — plus a one-click "switch to that tab" button.

If the page isn't open right now but it's anywhere in your browsing history,
Last Visited tells you that too: last visited date/time and how many times.

Click the toolbar icon any time for a full dashboard: every group of
duplicate tabs currently open (with per-tab "opened X ago"), and the current
tab's visit history.

PRIVACY
Everything runs locally in your browser. There is no backend, no account, no
analytics, and nothing is ever sent anywhere. See the privacy policy linked
on this listing for the full breakdown of what each permission is used for.

PERMISSIONS, IN PLAIN ENGLISH
- Tabs: to compare open tabs' URLs against each other.
- History: to check for any prior visit to the same page (skipped entirely
  in incognito windows).
- Notifications: to show the "already open" / "visited before" alert.
- Scripting: to show the small on-page badge next to the notification.
- Storage (session only): to remember when each tab was opened, cleared when
  the browser closes.
```

## Category

Productivity

## Data usage disclosure (Developer Dashboard → Privacy practices tab)

The dashboard asks you to check which data types the extension's code
touches — this is about local access, not transmission. Since nothing ever
leaves the device, answer the "purpose" and "certification" questions
honestly as below; see [PRIVACY.md](PRIVACY.md) for the full mapping of
permission → data → purpose.

**Data collected (check these):**
- Web history — used locally to detect recent visits; never stored or transmitted.
- Website content (tab URLs/titles) — used locally to detect duplicate tabs; never stored or transmitted.

**Certifications (all true for this extension):**
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to the item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

**"Does this item collect or use user data?"** → Yes (per the two categories
above) — but clarify in the listing/description that it's 100% local,
on-device only, matching the plain-English permissions section above.

## Screenshots (1280x800 or 640x400, at least 1 required)

Show:
1. The on-page badge with "Last Visited" + a real datetime, next to a
   duplicate-tab page.
2. The toolbar popup dashboard with a duplicate-tab group and history list.

(Screenshots can be captured from a local test run — see the extension in
action by loading it unpacked and opening the same page in two tabs.)
