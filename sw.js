// Gegenereerd door scripts/build-sw.mjs. Niet met de hand aanpassen: draai npm run build-sw.
// Zet alle bestanden van de app in de cache, zodat hij ook zonder internet werkt.
const VERSION = '416e274716bb';
const FILES = [
  "./",
  "assets/pieces/bB.svg",
  "assets/pieces/bK.svg",
  "assets/pieces/bN.svg",
  "assets/pieces/bP.svg",
  "assets/pieces/bQ.svg",
  "assets/pieces/bR.svg",
  "assets/pieces/wB.svg",
  "assets/pieces/wK.svg",
  "assets/pieces/wN.svg",
  "assets/pieces/wP.svg",
  "assets/pieces/wQ.svg",
  "assets/pieces/wR.svg",
  "css/style.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "src/board-view.js",
  "src/chess/constants.js",
  "src/chess/movegen.js",
  "src/chess/notation.js",
  "src/chess/perft.js",
  "src/chess/position.js",
  "src/chess/status.js",
  "src/chess/zobrist.js",
  "src/engine/common.js",
  "src/engine/engine.js",
  "src/engine/evaluate.js",
  "src/engine/levels.js",
  "src/engine/random.js",
  "src/engine/search.js",
  "src/engine/worker.js",
  "src/fen.js",
  "src/game.js",
  "src/main.js"
];
const CACHE = 'schaak-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

// Een nieuwe versie ruimt de caches van oude versies op.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('schaak-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Eerst uit de cache, anders van het netwerk. Offline krijgt een pagina die
// niet in de cache staat de startpagina.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (error) {
        if (request.mode === 'navigate') {
          const start = await cache.match('./');
          if (start) return start;
        }
        throw error;
      }
    }),
  );
});
