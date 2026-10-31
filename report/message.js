// Builds the styled Telegram daily report from one day's numbers.
// Kept separate from the Firebase/Telegram code so it can be tested on its own.

const r3 = n => Math.round(n * 1000) / 1000;
const kd = n => r3(n).toFixed(3);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Same wording as the WhatsApp message the owner sends by hand.
const NAMES = { Gatorade: "Gatorades", Racket: "Rackets", Grip: "Grips", "Protein Bar": "Protein Bars" };

// One aligned row inside a monospace block: label on the left, amount on the right.
function line(label, amount, width = 22) {
  const a = kd(amount);
  return label + " ".repeat(Math.max(1, width - label.length - a.length)) + a;
}

/**
 * @param {object} d
 * @param {string} d.date            "YYYY-MM-DD"
 * @param {string[]} d.products      item names in price-list order
 * @param {object[]} d.entries       that day's sales {product, amount, paid, cash, booking?, court?}
 * @param {object[]} d.bookings      that day's bookings {court}
 * @param {object[]} d.cashouts      that day's cash outs {amount, note}
 * @param {number} d.previousCash    cash already in the drawer at the start of the day
 */
function buildMessage(d) {
  const [y, m, dd] = d.date.split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const names = [...d.products];
  for (const e of d.entries) if (!names.includes(e.product)) names.push(e.product);
  const by = n => d.entries.filter(e => e.product === n).reduce((s, e) => s + e.amount, 0);
  const total = d.entries.reduce((s, e) => s + e.amount, 0);
  const paid = d.entries.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
  const cashIn = d.entries.filter(e => e.cash).reduce((s, e) => s + e.amount, 0);
  const cashOut = d.cashouts.reduce((s, o) => s + o.amount, 0);
  const drawer = d.previousCash + cashIn - cashOut;
  const rule = "─".repeat(22);

  const out = [];
  out.push("🎾 <b>PADEL NATION</b>");
  out.push("<i>Daily report · " + esc(when) + "</i>");
  out.push("");

  out.push("📊 <b>Account</b>");
  const rows = names.map(n => line(NAMES[n] || n, by(n)));
  out.push("<pre>" + esc([...rows, rule, line("TOTAL", total) + " KD"].join("\n")) + "</pre>");

  out.push("🏟 <b>Courts</b>");
  for (const c of [1, 2]) {
    const nb = d.bookings.filter(b => b.court === c).length;
    const amt = d.entries.filter(e => e.booking && e.court === c).reduce((s, e) => s + e.amount, 0);
    out.push("Court " + c + " · " + nb + " booking" + (nb === 1 ? "" : "s") + " · <b>" + kd(amt) + "</b> KD");
  }
  out.push("");

  out.push("💵 <b>Cash</b>");
  const cashRows = [line("Previous", d.previousCash), line("+ Cash sales", cashIn), line("− Cash out", cashOut), rule, line("IN DRAWER", drawer) + " KD"];
  out.push("<pre>" + esc(cashRows.join("\n")) + "</pre>");
  for (const o of d.cashouts) out.push("  ↳ " + esc(o.note || o.reason || "Cash out") + " · " + kd(o.amount));
  if (d.cashouts.length) out.push("");

  const unpaid = total - paid;
  out.push((unpaid > 0.0005 ? "⏳ Unpaid <b>" + kd(unpaid) + "</b> KD" : "✅ Everything paid") + "  ·  ✔️ Paid " + kd(paid) + " KD");
  return out.join("\n");
}

module.exports = { buildMessage, kd, r3 };
