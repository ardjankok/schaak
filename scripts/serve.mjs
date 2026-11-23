// Kleine lokale webserver om de app tijdens het bouwen te bekijken.
// Start met: npm start  (daarna http://localhost:8080 openen)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

export function createDevServer(rootDir) {
  const root = path.resolve(rootDir);

  return http.createServer(async (req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Ongeldige URL');
    }
    if (urlPath.includes('\0')) return send(res, 400, 'Ongeldige URL');
    if (urlPath.endsWith('/')) urlPath += 'index.html'; // ook in een submap, zoals GitHub Pages

    const filePath = path.resolve(root, '.' + urlPath);
    const relative = path.relative(root, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return send(res, 403, 'Verboden');
    }

    try {
      const body = await readFile(filePath);
      const type = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      send(res, 200, body, type);
    } catch {
      send(res, 404, 'Niet gevonden');
    }
  });
}

const isStartedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isStartedDirectly) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const port = Number(process.env.PORT ?? 8080);
  createDevServer(projectRoot).listen(port, '127.0.0.1', () => {
    console.log(`Schaak-app draait op http://localhost:${port}`);
  });
}
