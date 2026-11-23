import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDevServer } from '../scripts/serve.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let baseUrl;

before(async () => {
  server = createDevServer(projectRoot);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('/ geeft index.html als HTML', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.match(await res.text(), /<html lang="nl">/);
});

test('JavaScript-bestanden krijgen het type text/javascript', async () => {
  const res = await fetch(`${baseUrl}/scripts/serve.mjs`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/javascript/);
  await res.arrayBuffer();
});

test('een onbekend bestand geeft 404', async () => {
  const res = await fetch(`${baseUrl}/bestaat-niet.txt`);
  assert.equal(res.status, 404);
  await res.arrayBuffer();
});

test('bestanden buiten de map worden nooit gegeven', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'schaak-serve-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  await mkdir(path.join(tmp, 'root'));
  await writeFile(path.join(tmp, 'root', 'index.html'), '<html lang="nl"></html>');
  await writeFile(path.join(tmp, 'geheim.txt'), 'GEHEIM');

  const fixtureServer = createDevServer(path.join(tmp, 'root'));
  await new Promise((resolve) => fixtureServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => fixtureServer.close(resolve)));
  const fixtureUrl = `http://127.0.0.1:${fixtureServer.address().port}`;

  for (const attack of ['/..%2Fgeheim.txt', '/..%5Cgeheim.txt', '/%2e%2e%5Cgeheim.txt']) {
    const res = await fetch(`${fixtureUrl}${attack}`);
    const body = await res.text();
    assert.equal(res.status, 403, attack);
    assert.equal(body.includes('GEHEIM'), false, attack);
  }
});

test('een kapotte URL-codering geeft 400 in plaats van een crash', async () => {
  const res = await fetch(`${baseUrl}/%E0%A4%A`);
  assert.equal(res.status, 400);
  await res.arrayBuffer();
});

test('een map-adres met een slash geeft de index.html van die map, zoals GitHub Pages', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'schaak-serve-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  await mkdir(path.join(tmp, 'schaak'));
  await writeFile(path.join(tmp, 'schaak', 'index.html'), '<html lang="nl">submap</html>');

  const fixtureServer = createDevServer(tmp);
  await new Promise((resolve) => fixtureServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => fixtureServer.close(resolve)));
  const res = await fetch(`http://127.0.0.1:${fixtureServer.address().port}/schaak/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /submap/);
});
