// Preview only: gives the app the same database API as firebase.js, but kept in memory with made-up
// sample data. No login, nothing reaches Firebase, and reloading the page starts fresh.

const store = {};
const qsubs = [];
const dsubs = [];
let nextId = 0;
const col = name => store[name] || (store[name] = new Map());
const ops = { "==": (a, b) => a === b, "!=": (a, b) => a !== b, "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const snapDoc = (id, d) => ({ id, exists: !!d, data: () => d && { ...d }, metadata: { fromCache: false, hasPendingWrites: false } });

function run(name, q) {
  let rows = [...col(name).entries()].filter(([, d]) => q.f.every(([f, op, v]) => d[f] !== undefined && ops[op](d[f], v)));
  if (q.o) rows.sort((a, b) => cmp(a[1][q.o[0]], b[1][q.o[0]]) * (q.o[1] === "desc" ? -1 : 1));
  if (q.l) rows = rows.slice(0, q.l);
  const docs = rows.map(([id, d]) => snapDoc(id, d));
  return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false } };
}

function changed(name) {
  setTimeout(() => {
    for (const s of qsubs) if (s.name === name) s.cb(run(name, s.q));
    for (const s of dsubs) if (s.name === name) s.cb(snapDoc(s.id, col(name).get(s.id)));
  }, 0);
}

function docRef(name, id) {
  return {
    id, path: name + "/" + id,
    get: async () => snapDoc(id, col(name).get(id)),
    set: async d => { col(name).set(id, { ...d }); changed(name); },
    update: async p => { const cur = col(name).get(id); if (!cur) throw { code: "invalid_argument", message: "missing" }; col(name).set(id, { ...cur, ...p }); changed(name); },
    delete: async () => { col(name).delete(id); changed(name); },
    onSnapshot(cb) { const s = { name, id, cb }; dsubs.push(s); setTimeout(() => cb(snapDoc(id, col(name).get(id))), 0); return () => dsubs.splice(dsubs.indexOf(s), 1); }
  };
}

function query(name, q) {
  return {
    where: (f, op, v) => query(name, { ...q, f: [...q.f, [f, op, v]] }),
    orderBy: (f, dir = "asc") => query(name, { ...q, o: [f, dir] }),
    limit: l => query(name, { ...q, l }),
    get: async () => run(name, q),
    onSnapshot(cb) { const s = { name, q, cb }; qsubs.push(s); setTimeout(() => cb(run(name, q)), 0); return () => qsubs.splice(qsubs.indexOf(s), 1); }
  };
}

const db = {
  collection: name => Object.assign(query(name, { f: [] }), {
    path: name,
    doc: id => docRef(name, id || "demo" + (++nextId)),
    add: async d => { const id = "demo" + (++nextId); col(name).set(id, { ...d }); changed(name); return docRef(name, id); }
  }),
  doc: path => { const [c, id] = path.split("/"); return docRef(c, id); }
};

// ---- Sample data: today and yesterday, so every part of the app has something in it ----
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = iso(new Date());
const y = new Date(); y.setDate(y.getDate() - 1);
const yesterday = iso(y);
let t = Date.now() - 6 * 3600 * 1000;
const at = () => (t += 7 * 60 * 1000);
const put = (name, id, d) => col(name).set(id, d);

put("config", "main", { business: "Court Daily Income", products: [
  { name: "Court", prices: [15, 20, 26, 30, 36, 52], noQty: true },
  { name: "Water", prices: [0.25] }, { name: "Gatorade", prices: [0.75] },
  { name: "Racket", prices: [1] }, { name: "Balls", prices: [3, 3.5], perPrice: true }, { name: "Grip", prices: [1.5] }
] });

// Yesterday: a few sales, a hand-typed opening cash, and its daily cash summary (for the carry-over).
put("drawer", yesterday, { date: yesterday, previous: 20, at: at() });
[["Court", 30, true, true], ["Water", 0.5, true, true], ["Gatorade", 1.5, true, false], ["Balls", 3.5, true, true]].forEach(([product, amount, paid, cash], row) =>
  put("entries", "y" + row, { date: yesterday, product, row: 0, amount, qty: 1, unit: amount, paid, cash, at: at() }));
put("cashouts", "yo1", { date: yesterday, amount: 2.5, note: "Tissues", at: at() });
put("days", yesterday, { date: yesterday, cashIn: 34, cashOut: 2.5, at: at() });

// Today: a Court 1 booking split between four players, plus walk-in sales.
put("bookings", "b1", { date: today, court: 1, name: "Bo Fahad", at: at() });
for (let p = 0; p < 4; p++) put("entries", "bc" + p, { date: today, product: "Court", row: 0, amount: 6.5, qty: 1, unit: 6.5, paid: p < 2, cash: p === 0, booking: "b1", player: p, court: 1, split: 4, at: at() });
put("entries", "bw1", { date: today, product: "Water", row: 0, amount: 0.5, qty: 2, unit: 0.25, paid: true, cash: true, booking: "b1", player: 1, court: 1, at: at() });
put("entries", "w1", { date: today, product: "Court", row: 1, amount: 20, qty: 1, unit: 20, paid: true, cash: true, at: at() });
put("entries", "w2", { date: today, product: "Gatorade", row: 0, amount: 0.75, qty: 1, unit: 0.75, paid: false, cash: false, at: at() });
put("entries", "w3", { date: today, product: "Grip", row: 0, amount: 1.5, qty: 1, unit: 1.5, paid: true, cash: true, at: at() });
put("cashouts", "o1", { date: today, amount: 1, note: "Garbage bags", at: at() });

// ---- Demo banner; no sign-in needed ----
const banner = document.createElement("div");
banner.className = "demo-banner";
banner.innerHTML = "<b>Design preview</b> · sample data, nothing is saved. Reload to start over.";
document.body.prepend(banner);
// Act as the owner so every part of the app (Settings included) can be tried.
window.__user = { email: "crowly@padelnation.app" };
window.__resolveDb(db);
window.dispatchEvent(new CustomEvent("syncstate", { detail: { pending: 0, online: navigator.onLine } }));
