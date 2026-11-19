/* Cache runtime assets, including the unmodified Stockfish wasm, for offline and repeat loads.
   The engine files are stored as-is and never rewritten. */
const CACHE = "sparring-coach-1.6.2";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./favicon.svg",
  "./icon.png",
  "./vendor/chess.js",
  "./js/chess-san.js",
  "./js/db.js",
  "./js/entitlements.js",
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
  "./js/progress.js",
  "./js/strength.js",
  "./js/feel.js",
  "./vendor/fonts/fraunces-display.woff2",
  "./vendor/sfx/move.ogg",
  "./vendor/sfx/capture.ogg",
  "./vendor/sfx/check.ogg",
  "./vendor/sfx/good.ogg",
  "./vendor/sfx/ok.ogg",
  "./vendor/sfx/miss.ogg",
  "./vendor/sfx/tap.ogg",
  "./vendor/sfx/combo.ogg",
  "./vendor/sfx/level.ogg",
  "./vendor/sfx/win.ogg",
  "./vendor/sfx/badge.ogg",
  "./vendor/sfx/boss.ogg",
  "./js/lessons.js",
  "./js/pack-key.js",
  "./js/packs.js",
  "./js/result.js",
  "./js/adventure.js",
  "./js/rush.js",
  "./js/boardview.js",
  "./js/portraits.js",
  "./js/photo.js",
  "./js/calc.js",
  "./js/clock.js",
  "./js/badges.js",
  "./js/ui.js",
  "./js/drill-audit.js",
  "./js/app.js",
  "./vendor/noble-ed25519.mjs",
  "./data/lessons/units.json",
  "./data/lessons/rush.json",
  "./data/train/calc.json",
  "./data/packs/weekly-sample.json",
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
