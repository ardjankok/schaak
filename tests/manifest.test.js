import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));

test('het manifest maakt een app zonder browserbalk', () => {
  assert.equal(manifest.name, 'Schaak');
  assert.equal(manifest.short_name, 'Schaak');
  assert.equal(manifest.lang, 'nl');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});

test('het manifest heeft pictogrammen van 192 en 512 px en een maskable', () => {
  const sizes = (purpose) => manifest.icons.filter((icon) => (icon.purpose ?? 'any') === purpose).map((icon) => icon.sizes);
  assert.ok(sizes('any').includes('192x192'));
  assert.ok(sizes('any').includes('512x512'));
  assert.ok(sizes('maskable').length >= 1);
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `${icon.src} moet relatief zijn`);
    assert.ok(existsSync(icon.src), `${icon.src} bestaat niet`);
    assert.equal(icon.type, 'image/png');
  }
});

test('de pagina verwijst naar het manifest en heeft een themakleur', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<meta name="theme-color" content="#b58863">/);
});
