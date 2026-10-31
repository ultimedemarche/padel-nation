// Nightly Telegram report, run by GitHub Actions (see .github/workflows/daily-report.yml).
// Reads one day's numbers from Firebase and posts the styled report to the Telegram chat.
//
// Secrets (GitHub → Settings → Secrets and variables → Actions):
//   TELEGRAM_BOT_TOKEN        from @BotFather
//   TELEGRAM_CHAT_ID          where to post (find it with MODE=find-chat-id)
//   FIREBASE_SERVICE_ACCOUNT  the JSON key from Firebase → Project settings → Service accounts
// Inputs:
//   REPORT_DATE  "YYYY-MM-DD" (empty = the day that just ended in Kuwait)
//   MODE         "send" (default) or "find-chat-id"

const { buildMessage, r3 } = require("./message.js");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MODE = (process.env.MODE || "send").trim();

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description}`);
  return json.result;
}

// Lists the chats that have messaged the bot, so the right chat ID can be copied into the secret.
async function findChatId() {
  const updates = await telegram("getUpdates");
  const chats = new Map();
  for (const u of updates) {
    const c = (u.message || u.channel_post || u.my_chat_member || {}).chat;
    if (c) chats.set(c.id, c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "chat");
  }
  if (!chats.size) {
    console.log("No chats yet. Send any message to the bot (or add it to your group and send a message there), then run this again.");
    return;
  }
  console.log("Chats that messaged the bot:");
  for (const [id, name] of chats) console.log(`  ${name}  →  TELEGRAM_CHAT_ID = ${id}`);
}

// The day that just ended, in Kuwait time (the job runs a few minutes after midnight there).
function yesterdayInKuwait() {
  const now = new Date(Date.now() + 3 * 3600 * 1000);   // Kuwait is UTC+3 all year
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

async function sendReport() {
  const admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const fs = admin.firestore();

  const day = (process.env.REPORT_DATE || "").trim() || yesterdayInKuwait();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`REPORT_DATE must look like 2026-10-31, got "${day}"`);
  const rows = async coll => (await fs.collection(coll).where("date", "==", day).get()).docs.map(d => d.data());

  const [entries, bookings, cashouts, configSnap, drawerSnap] = await Promise.all([
    rows("entries"), rows("bookings"), rows("cashouts"),
    fs.doc("config/main").get(), fs.doc(`drawer/${day}`).get()
  ]);
  const products = configSnap.exists && Array.isArray(configSnap.data().products)
    ? configSnap.data().products.map(p => p.name)
    : ["Court", "Water", "Gatorade", "Racket", "Balls", "Grip"];

  // Previous cash, worked out the same way as the app: typed by hand for that day if it was,
  // otherwise the last hand-typed amount plus each day's cash sales minus cash out since then.
  let previousCash;
  if (drawerSnap.exists && typeof drawerSnap.data().previous === "number") {
    previousCash = drawerSnap.data().previous;
  } else {
    const anchor = await fs.collection("drawer").where("date", "<", day).orderBy("date", "desc").limit(1).get();
    let base = 0, from = null;
    if (!anchor.empty) { base = Number(anchor.docs[0].data().previous) || 0; from = anchor.docs[0].data().date; }
    let q = fs.collection("days").where("date", "<", day);
    if (from) q = q.where("date", ">=", from);
    const days = await q.get();
    previousCash = days.docs.reduce((s, d) => s + (Number(d.data().cashIn) || 0) - (Number(d.data().cashOut) || 0), base);
  }

  const text = buildMessage({ date: day, products, entries, bookings, cashouts, previousCash: r3(previousCash) });
  await telegram("sendMessage", { chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true });
  console.log(`Sent the report for ${day} (${entries.length} sales).`);
}

(async () => {
  if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN secret is missing.");
  if (MODE === "find-chat-id") return findChatId();
  if (!process.env.TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID secret is missing. Run the workflow with mode find-chat-id first.");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT secret is missing.");
  await sendReport();
})().catch(err => { console.error(err.message || err); process.exit(1); });
