import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodePng, drawIcon } from '../scripts/make-icons.mjs';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Eigen CRC32 (zoals in de PNG-standaard), om de encoder na te rekenen. */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const pixel = (rgba, size, x, y) => Array.from(rgba.slice((y * size + x) * 4, (y * size + x) * 4 + 4));

test('encodePng maakt een geldige PNG-kop', () => {
  const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 128]));
  assert.deepEqual(png.subarray(0, 8), SIGNATURE);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 1);
  assert.equal(png[24], 8); // bitdiepte
  assert.equal(png[25], 6); // RGBA
  assert.equal(png.readUInt32BE(29), crc32(png.subarray(12, 29)));
});

test('het pictogram heeft een witte pion in het midden en ronde hoeken', () => {
  const rgba = drawIcon(192);
  assert.equal(rgba.length, 192 * 192 * 4);
  assert.deepEqual(pixel(rgba, 192, 96, 96), [255, 255, 255, 255]);
  assert.equal(pixel(rgba, 192, 0, 0)[3], 0);
});

test('het maskable pictogram is tot in de hoeken gevuld', () => {
  const rgba = drawIcon(512, { maskable: true });
  assert.equal(pixel(rgba, 512, 0, 0)[3], 255);
  assert.deepEqual(pixel(rgba, 512, 256, 256), [255, 255, 255, 255]);
});

test('de pictogrammen in icons/ zijn up-to-date', () => {
  const cases = [
    ['icons/icon-192.png', 192, false],
    ['icons/icon-512.png', 512, false],
    ['icons/icon-maskable-512.png', 512, true],
  ];
  for (const [file, size, maskable] of cases) {
    assert.ok(readFileSync(file).equals(encodePng(size, size, drawIcon(size, { maskable }))), `${file}: draai npm run icons`);
  }
});
