/* Cache runtime assets, including the unmodified Stockfish wasm, for offline and repeat loads.
   The engine files are stored as-is and never rewritten. */
const CACHE = "sparring-coach-1.5.0";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./favicon.svg",
  "./icon.png",
  "./vendor/chess.js",
  "./js/db.js",
  "./js/fsrs.js",
  "./js/account.js",
  "./js/think.js",
  "./js/today.js",
  "./js/profiles.js",
  "./js/sound.js",
  "./js/coach.js",
  "./js/smirnov.js",
  "./js/engine.js",
  "./js/board.js",
  "./js/fianchetto.js",
  "./js/openings.js",
  "./js/find.js",
  "./js/practice.js",
  "./js/ui.js",
  "./js/drill-audit.js",
  "./js/app.js",
  "./engine/stockfish/stockfish-19-lite-single.js",
  "./engine/stockfish/stockfish-19-lite-single.wasm"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && url.protocol.startsWith("http")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
