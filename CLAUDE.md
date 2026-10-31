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

## Nightly Telegram report
- `.github/workflows/daily-report.yml` runs at 21:03 UTC (00:03 Kuwait) and on demand (Actions → Run workflow;
  `mode: find-chat-id` lists chats that messaged the bot; `date` resends a past day).
- `report/telegram-report.js` reads that day from Firestore with firebase-admin and posts to Telegram (HTML).
  `report/message.js` builds the styled text; test it locally with `migration/data.json`.
- Secrets in GitHub: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FIREBASE_SERVICE_ACCOUNT. Never commit them.
- GitHub pauses scheduled workflows after 60 days with no commits to the repo; re-enable under Actions if so.

## Publishing a change
Edit, check locally, then `git add -A && git commit -m "..." && git push`. GitHub Pages updates in about a minute.
