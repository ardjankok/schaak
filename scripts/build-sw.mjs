// Maakt sw.js: de service worker die alle bestanden van de app in de cache zet,
// zodat de app zonder internet werkt. De versie volgt uit de inhoud van de
// bestanden, dus elke wijziging geeft een nieuwe cache. Start met: npm run build-sw
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FOLDERS = ['css', 'assets', 'icons', 'src'];
const ROOT_FILES = ['index.html', 'manifest.webmanifest'];
/** Bestanden die wel in de map staan, maar die de app niet laadt. */
const SKIP = new Set(['src/engine/search-v1.js']);

function walk(rootDir, folder) {
  return readdirSync(path.join(rootDir, folder), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${folder}/${entry.name}`;
    return entry.isDirectory() ? walk(rootDir, relative) : [relative];
  });
}

/** Alle bestanden die de app nodig heeft, relatief en gesorteerd. './' is de startpagina zelf. */
export function appFiles(rootDir) {
  const files = [...ROOT_FILES, ...FOLDERS.flatMap((folder) => walk(rootDir, folder))].filter((file) => !SKIP.has(file));
  return ['./', ...files].sort();
}

/** De volledige tekst van sw.js. */
export function buildServiceWorker(rootDir) {
  const files = appFiles(rootDir);
  const hash = createHash('sha256');
  for (const file of files) {
    if (file === './') continue;
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(path.join(rootDir, file)));
  }
  const version = hash.digest('hex').slice(0, 12);
  return `// Gegenereerd door scripts/build-sw.mjs. Niet met de hand aanpassen: draai npm run build-sw.
// Zet alle bestanden van de app in de cache, zodat hij ook zonder internet werkt.
const VERSION = '${version}';
const FILES = ${JSON.stringify(files, null, 2)};
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
`;
}

// Rechtstreeks gestart: schrijf sw.js in de hoofdmap van het project.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  writeFileSync(path.join(rootDir, 'sw.js'), buildServiceWorker(rootDir));
  console.log(`geschreven: sw.js (${appFiles(rootDir).length} bestanden)`);
}
