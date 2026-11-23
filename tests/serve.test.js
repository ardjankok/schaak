import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
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

for (const path of ['/..%2Fpackage.json', '/..%5Cpackage.json', '/..%2F..%2Fapp%2Fpackage.json']) {
  test(`buiten de projectmap komen lukt niet: ${path}`, async () => {
    const res = await fetch(`${baseUrl}${path}`);
    assert.ok([403, 404].includes(res.status), `status was ${res.status}`);
    await res.arrayBuffer();
  });
}

test('een kapotte URL-codering geeft 400 in plaats van een crash', async () => {
  const res = await fetch(`${baseUrl}/%E0%A4%A`);
  assert.equal(res.status, 400);
  await res.arrayBuffer();
});
