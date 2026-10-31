# Padel Nation · Court Daily Income

Daily sales app for a padel court business in Kuwait, used on a company iPad (also works on phones).
Static site on GitHub Pages; data in Firebase (Firestore + Email/Password login).

## Files
- `index.html` — the whole app (HTML, CSS, JS in one file). Started life as a claude.ai artifact.
- `firebase.js` — Firebase setup, sign-in screen, and a small adapter that gives the app the
  `db.collection(...).where().orderBy().onSnapshot()` / `db.doc(path).set()` API it was written against.
  The app gets it through `window.claude.use("db")` (a shim in `<head>` of index.html).
- `import.html` — one-time copy of data exported from the old Claude version (`migration/`, git-ignored).
- `manifest.webmanifest`, `icon-*.png`, `logo.png` — Home Screen app icon.

## Data (Firestore collections)
- `entries` — one sale: {date "YYYY-MM-DD", product, row, amount (KD, 3 decimals), qty, unit, paid, cash, at}.
  Court-tab sales also have {booking, player 0-3, court 1|2, split?}.
- `bookings` — {date, court, name, at}.
- `config/main` — {business, products: [{name, prices[], noQty?, perPrice?}]}.
- `cashouts` — {date, amount, note, at}.
- `drawer/<date>` — Previous cash typed by hand {date, previous}.
- `days/<date>` — {date, cashIn, cashOut}; kept in sync while that day is open; the Previous-cash
  carry-over adds these up since the last hand-typed `drawer` anchor.
Queries that filter one field and sort another are sorted on the device (firebase.js) so no
composite indexes are needed.

## The owner's preferences (keep these)
- Currency KD with 3 decimals. New sales start unticked; Paid and Cash marks are independent.
- Items tab: don't change it when asked for Court-tab changes.
- Booking Court/Balls shares show combined (one full amount) in the Items table.
- Dark aurora + liquid-glass look, Sora font on buttons, morphing hover.
- WhatsApp report must match their own message format exactly (see `reportText()`).
- Every delete asks first and offers Undo.
- Test layout at phone and iPad widths before publishing (rules in the "Fitting every phone and tablet" CSS block).

## Demo mode
`index.html?demo` loads `demo.js` instead of `firebase.js`: same database API, in memory, with made-up sample
data (today + yesterday), no login, nothing saved, reload resets. Share this link with testers.

## Daily report
The "Daily report" button opens a preview of the styled WhatsApp message (*bold*, _italic_, ``` block with
aligned amounts; same content as the owner's: each item, TOTAL, "I have Cash") with "Copy message" and
"Open WhatsApp". The company iPad can't install WhatsApp, so Copy is the main way to send it.
(A nightly Telegram robot was built and then removed at the owner's request; don't bring it back unasked.)

## Publishing a change
Edit, check locally, then `git add -A && git commit -m "..." && git push`. GitHub Pages updates in about a minute.
