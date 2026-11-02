# Padel Nation · Court Daily Income

Daily sales app for a padel court business in Kuwait, used on a company iPad (also works on phones).
Static site on GitHub Pages; data in Firebase (Firestore + Email/Password login).

## Files
- `index.html` — the whole app (HTML, CSS, JS in one file). Started life as a claude.ai artifact.
- `firebase.js` — Firebase setup, sign-in screen, and a small adapter that gives the app the
  `db.collection(...).where().orderBy().onSnapshot()` / `db.doc(path).set()` API it was written against.
  The app gets it through `window.claude.use("db")` (a shim in `<head>` of index.html).
- `import.html` — one-time copy of data exported from the old Claude version (`migration/`, git-ignored).
- `theme.css` — the look (loaded after index.html's own styles): logo navy/lime/racket green + orange,
  matte working cards, frosted glass on floating parts (header, tabs, pills, lock bar, popups),
  Plus Jakarta Sans. The old aurora layer in index.html is hidden by it.
- `bg.mp4` / `bg.jpg` — background padel clip, pre-blurred and darkened with ffmpeg (540x960, no audio);
  extra darkness comes from `.bgvid::after` in theme.css. sw.js leaves video requests alone.
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
- `customers` — {name, at, by}. `credit` — {customer, kind "took" | "paid", date, amount, at, by};
  "took" has `entries` (sale ids) + `items` (labels), or a typed amount with `note`; "paid" has `cash`.
  Sales put on credit get {paid: true, cash: false, credit: <credit id>} and can only be changed from the Credit section.
  They are left out of the Items table, every total and the report TOTAL (`counted()`); only paid sales count there.

## Customer credit
On in the real app since 2026-10-31 (`const CREDIT = true` in index.html). Credit section at the bottom of every tab (not a tab): "Not paid yet" list with
Add to credit per sale (asks the customer name), "+ Add credit" for a typed amount (owner PIN for both),
Payment (anyone, all or part, cash goes into Cash in drawer and `days/<date>.cashIn`), Copy reminder.
The WhatsApp report gets credit lines (no heading) BELOW the cash line, only on days credit was given or paid back:
"• Name - 10.000 KD" (credit given), "• Name - paid 5.000 KD (still owes …)" (payment). On a day a customer pays, only their paid line shows.
Money paid back that day (`creditPaid()`, cash or not) is a row under the customer's name in the report block and is added to
the report TOTAL and the top Final total / Paid figures. The Items table itself stays sales-only.
The whole section is locked until the owner PIN opens it (`creditOpen`; locks again on Lock or when the app
goes to the background). A fully paid customer can be removed: `customers/<id>.hidden = true` (records kept,
so old reports still show the name; adding credit under the same name brings them back).

## Test link (demo)
https://ultimedemarche.github.io/padel-nation/?demo loads `demo.js` instead of firebase.js: same database API,
in memory, sample data (today + yesterday, one credit customer), no login, acts as the owner, owner PIN 1234,
nothing saved (reload starts over). Brought back 2026-11-01 for testing while the owner uses the real app.

## Being tried in the demo first (`TRYING` in index.html = ?demo)
- `NOZOOM`: pinch and double-tap zoom blocked (viewport maximum-scale=1 + gesture events stopped + touch-action).
- `LOGS`: hidden activity log. `logs` docs {date (real day), sheet (day changed), at, by, action add|edit|delete|undo,
  text, amount?}. Written by `logAct()` on sales added/changed/deleted, bookings, cash outs, previous cash, credit,
  and Undo. Seen only in Settings → Activity log (owner PIN); the app never deletes logs.
To switch these on in the real app, set the flag to `true` (and consider Firestore rules making `logs`
create-only, so nobody can delete them from outside the app).

## People, Settings, locking
- Owner = `crowly@padelnation.app` (const OWNER in index.html, and in the Firestore rules). Other logins are
  staff, added in Firebase → Authentication → Users. Every new record stores `by` (login email).
- ⚙️ Settings (owner login only) edits `config/main.products` and the owner PIN (`config/main.pinHash`,
  SHA-256 of "padel-nation:" + PIN). Asks for the PIN when one is set.
- Past days are read-only (lock bar); unlocking needs the owner PIN (or the owner login if no PIN yet).
- Staff logins see dismissible tips; the owner's login never does.
- `sw.js` keeps the app openable offline (own files network-first with `cache: "no-cache"` because GitHub
  Pages sends max-age=600, Firebase SDK cache-first). Bump `CACHE` when changing sw.js; the page reloads
  itself once when a new worker takes over. Settings has a "Reload app" button. The top-bar
  "Saved" pill counts unsettled writes in firebase.js.

## The owner's preferences (keep these)
- Currency KD with 3 decimals. New sales start unticked; Paid and Cash marks are independent.
- Items tab: don't change it when asked for Court-tab changes.
- Court-tab sales reach the Items table and every total (score strip, footer rows, report) only once that
  player is ticked Paid (`counted()`); unpaid shares stay as "Owed" on the booking card.
- Booking Court/Balls paid shares show combined in one Items cell (2 of 4 paid → 2 shares' worth).
- Cash marks only appear/count on paid sales; unticking Paid clears cash.
- Dark aurora + liquid-glass look, Sora font on buttons, morphing hover.
- WhatsApp report must match their own message format exactly (see `reportText()`).
- Every delete asks first and offers Undo.
- Test layout at phone and iPad widths before publishing (rules in the "Fitting every phone and tablet" CSS block).

## Daily report
The "Daily report" button opens a preview of the styled WhatsApp message (*bold*, _italic_, ``` block with
aligned amounts; same content as the owner's: each item, TOTAL, "I have Cash") with "Copy message" and
"Open WhatsApp". The company iPad can't install WhatsApp, so Copy is the main way to send it.
(A nightly Telegram robot was built and then removed at the owner's request; don't bring it back unasked.)

## Publishing a change
Edit, check locally, then `git add -A && git commit -m "..." && git push`. GitHub Pages updates in about a minute.
