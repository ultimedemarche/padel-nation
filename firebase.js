// Connects the app to Firebase.
// The app was first built on Claude's storage, so this file offers the same small API it expects
// (collection / doc / where / orderBy / limit / get / onSnapshot / add / set / update / delete)
// and answers it with Firestore. It also runs the sign-in screen.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, query, where, orderBy, limit,
  getDocs, getDoc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Not secret: this only says which Firebase project to talk to.
// The data is protected by the login and the Firestore security rules.
const firebaseConfig = {
  apiKey: "AIzaSyDUwEyZBIIlxcbR3pNYzwg61r7RrNaqi8g",
  authDomain: "padel-nation.firebaseapp.com",
  projectId: "padel-nation",
  storageBucket: "padel-nation.firebasestorage.app",
  messagingSenderId: "214880130498",
  appId: "1:214880130498:web:941bddea3317dc989ab25b"
};

const app = initializeApp(firebaseConfig);
// Keeps a copy on the device, so the app opens fast and keeps working when the Wi-Fi drops.
const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const auth = getAuth(app);

// ---- Errors in the shape the app already handles ----
const mapError = e => ({
  code: e && e.code === "permission-denied" ? "invalid_argument"
    : e && e.code === "resource-exhausted" ? "quota_exceeded"
    : "unavailable",
  message: (e && e.message) || "Something went wrong"
});
const guard = async fn => { try { return await fn(); } catch (e) { throw mapError(e); } };

// ---- Snapshots ----
const wrapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function wrapQuery(s, spec) {
  let docs = s.docs.map(wrapDoc);
  // Sorting and limits Firestore couldn't do without an extra index are done here instead.
  if (spec.order && !spec.serverOrder) {
    const [f, dir] = spec.order;
    docs.sort((a, b) => cmp(a.data()[f], b.data()[f]) * (dir === "desc" ? -1 : 1));
    if (spec.lim) docs = docs.slice(0, spec.lim);
  }
  return { docs, size: docs.length, empty: !docs.length, metadata: s.metadata };
}

// ---- Queries ----
function makeQuery(path, spec) {
  const build = () => {
    const parts = spec.filters.map(([f, op, v]) => where(f, op, v));
    // Firestore needs a custom index to filter on one field and sort on another.
    // When that would happen, sort on the device instead (each query here returns one day or a date range).
    spec.serverOrder = !!spec.order && spec.filters.every(([f]) => f === spec.order[0]);
    if (spec.serverOrder) {
      parts.push(orderBy(spec.order[0], spec.order[1]));
      if (spec.lim) parts.push(limit(spec.lim));
    } else if (spec.lim && !spec.order) parts.push(limit(spec.lim));
    return query(collection(fs, path), ...parts);
  };
  const next = patch => makeQuery(path, { ...spec, ...patch });
  return {
    where: (f, op, v) => next({ filters: [...spec.filters, [f, op, v]] }),
    orderBy: (f, dir = "asc") => next({ order: [f, dir] }),
    limit: n => next({ lim: n }),
    get: () => guard(async () => { const q = build(); return wrapQuery(await getDocs(q), spec); }),
    onSnapshot(cb, err) {
      const q = build();
      return onSnapshot(q, s => cb(wrapQuery(s, spec)), e => err && err(mapError(e)));
    }
  };
}

function docRef(path) {
  const ref = doc(fs, path);
  return {
    id: ref.id,
    path,
    get: () => guard(async () => wrapDoc(await getDoc(ref))),
    set: data => guard(() => setDoc(ref, data)),
    update: data => guard(() => updateDoc(ref, data)),
    delete: () => guard(() => deleteDoc(ref)),
    onSnapshot: (cb, err) => onSnapshot(ref, s => cb(wrapDoc(s)), e => err && err(mapError(e))),
    collection: sub => collRef(path + "/" + sub)
  };
}

function collRef(path) {
  return Object.assign(makeQuery(path, { filters: [], order: null, lim: null }), {
    path,
    doc: id => docRef(id ? path + "/" + id : doc(collection(fs, path)).path),
    add: data => guard(async () => { const r = await addDoc(collection(fs, path), data); return docRef(r.path); })
  });
}

const db = { collection: collRef, doc: docRef };

// ---- Sign in ----
const $ = id => document.getElementById(id);
let handedOver = false;

onAuthStateChanged(auth, user => {
  const login = $("login");
  if (user) {
    login.hidden = true;
    $("whoami").textContent = "Signed in as " + user.email;
    $("signFoot").hidden = false;
    if (!handedOver) { handedOver = true; window.__resolveDb(db); }
  } else {
    login.hidden = false;
    $("signFoot").hidden = true;
    setTimeout(() => $("loginEmail").focus(), 50);
  }
});

$("loginForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  const btn = $("loginBtn"), msg = $("loginErr");
  msg.textContent = "";
  btn.disabled = true; btn.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPass").value);
    $("loginPass").value = "";
  } catch (e) {
    msg.textContent = e && (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found")
      ? "That email or password isn't right. Try again."
      : e && e.code === "auth/network-request-failed"
        ? "No internet connection. Check the Wi-Fi and try again."
        : "Couldn't sign in. Try again in a moment.";
  } finally {
    btn.disabled = false; btn.textContent = "Sign in";
  }
});

$("signOut").addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});
