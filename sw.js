// Keeps a copy of the app on the device so it opens even without internet.
// The app's own files are fetched fresh when online (so updates arrive straight away) and fall back to
// the saved copy when offline. Firebase's code files never change for a version, so they're served from
// the saved copy. Sales data is handled separately by Firestore's own offline storage.

const CACHE = "padel-nation-v3";
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const SHELL = [
  "./", "./index.html", "./firebase.js", "./theme.css", "./manifest.webmanifest",
  "./logo.png", "./bg.jpg", "./icon-180.png", "./icon-192.png", "./icon-512.png",
  SDK + "firebase-app.js", SDK + "firebase-firestore.js", SDK + "firebase-auth.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // The background video streams in pieces; leave it to the browser (offline, bg.jpg shows instead).
  if (req.destination === "video" || url.pathname.endsWith(".mp4") || req.headers.has("range")) return;

  // Firebase SDK files: saved copy first.
  if (req.url.startsWith(SDK)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  // The app's own files: fresh when online, saved copy when offline.
  // "no-cache" makes the browser ask GitHub every time (GitHub would otherwise allow a 10-minute-old copy);
  // when nothing changed GitHub answers with a tiny "not modified", so it stays fast.
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
  }
  // Everything else (Firestore, sign-in, fonts) goes straight to the network as usual.
});
