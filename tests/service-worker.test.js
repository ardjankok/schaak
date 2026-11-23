import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appFiles, buildServiceWorker } from '../scripts/build-sw.mjs';

const files = appFiles('.');
const version = (text) => text.match(/const VERSION = '([0-9a-f]{12})';/)?.[1];

test('alle bestanden van de app gaan mee in de cache', () => {
  for (const expected of ['./', 'index.html', 'manifest.webmanifest', 'src/main.js', 'src/engine/worker.js',
    'src/engine/search.js', 'css/style.css', 'icons/icon-512.png']) {
    assert.ok(files.includes(expected), expected);
  }
  assert.equal(files.filter((f) => f.startsWith('assets/pieces/')).length, 12);
  assert.deepEqual(files, [...files].sort());
});

test('bestanden die de app niet gebruikt, gaan niet mee', () => {
  assert.ok(!files.includes('src/engine/search-v1.js'));
  assert.ok(!files.includes('sw.js'));
  for (const file of files) assert.ok(!/^(tests|scripts|docs|node_modules|\.superpowers)\//.test(file), file);
});

test('elk pad bestaat en is relatief', () => {
  for (const file of files) {
    assert.ok(!file.startsWith('/'), file);
    if (file !== './') assert.ok(existsSync(file), file);
  }
});

test('sw.js is bijgewerkt (anders: npm run build-sw)', () => {
  assert.equal(readFileSync('sw.js', 'utf8'), buildServiceWorker('.'));
});

test('een andere inhoud geeft een andere versie', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'schaak-sw-'));
  try {
    for (const file of files.filter((f) => f !== './')) {
      mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      copyFileSync(file, path.join(dir, file));
    }
    const before = version(buildServiceWorker(dir));
    assert.equal(before, version(buildServiceWorker('.')));
    writeFileSync(path.join(dir, 'css/style.css'), readFileSync('css/style.css', 'utf8') + ' ');
    assert.notEqual(version(buildServiceWorker(dir)), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('de pagina registreert de service worker met een relatief pad', () => {
  assert.match(readFileSync('src/main.js', 'utf8'), /navigator\.serviceWorker\.register\('sw\.js'\)/);
});
