// Tekent de app-pictogrammen (een witte pion op een stukje schaakbord) en
// schrijft ze als PNG, zonder afhankelijkheden. Start met: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LIGHT = [0xf0, 0xd9, 0xb5];
const DARK = [0xb5, 0x88, 0x63];
const PAWN = [0xff, 0xff, 0xff];
const OUTLINE = [0x2b, 0x26, 0x22];
const CORNER_RADIUS = 0.18; // van de rand, alleen bij het gewone pictogram
const OUTLINE_WIDTH = 0.03; // van de maat
const SAMPLES = 4; // 4 × 4 monsters per pixel tegen kartelranden

// --- PNG ---------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Een RGBA-afbeelding als PNG (kleurtype 6, filter 0 per rij). */
export function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bitdiepte
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0; // filter: geen
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Tekenen -----------------------------------------------------------

/**
 * Ligt (u, v) in de pion? Pion-eenheden: v van 0 (bovenkant) tot 1 (voet),
 * u horizontaal vanaf het midden. `grow` maakt elke vorm dikker (voor de rand).
 */
function inPawn(u, v, grow = 0) {
  const inCircle = (cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= (r + grow) ** 2;
  const inEllipse = (cx, cy, rx, ry) => ((u - cx) / (rx + grow)) ** 2 + ((v - cy) / (ry + grow)) ** 2 <= 1;
  const head = inCircle(0, 0.17, 0.16);
  const collar = inEllipse(0, 0.37, 0.2, 0.05);
  const bodyTop = 0.38;
  const bodyBottom = 0.82;
  const halfWidth = 0.1 + ((Math.min(Math.max(v, bodyTop), bodyBottom) - bodyTop) / (bodyBottom - bodyTop)) * 0.2;
  const body = v >= bodyTop - grow && v <= bodyBottom + grow && Math.abs(u) <= halfWidth + grow;
  const base = v >= 0.8 - grow && v <= 1 + grow && Math.abs(u) <= 0.36 + grow;
  return head || collar || body || base;
}

function inRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

/** Kleur (RGBA, 0–255) op punt (x, y) in [0, 1]. */
function colorAt(x, y, maskable) {
  if (!maskable && !inRoundedSquare(x, y, CORNER_RADIUS)) return [0, 0, 0, 0];
  const pawnHeight = maskable ? 0.48 : 0.62;
  const top = (1 - pawnHeight) / 2;
  const u = (x - 0.5) / pawnHeight;
  const v = (y - top) / pawnHeight;
  if (inPawn(u, v)) return [...PAWN, 255];
  if (inPawn(u, v, OUTLINE_WIDTH / pawnHeight)) return [...OUTLINE, 255];
  const light = (Math.floor(x * 4) + Math.floor(y * 4)) % 2 === 0;
  return [...(light ? LIGHT : DARK), 255];
}

/** Het pictogram als RGBA-pixels (size × size × 4). */
export function drawIcon(size, { maskable = false } = {}) {
  const rgba = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const [cr, cg, cb, ca] = colorAt((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size, maskable);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round(a / (SAMPLES * SAMPLES));
    }
  }
  return rgba;
}

// Rechtstreeks gestart: schrijf de drie pictogrammen.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
  mkdirSync(dir, { recursive: true });
  for (const [name, size, maskable] of [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
  ]) {
    writeFileSync(path.join(dir, name), encodePng(size, size, drawIcon(size, { maskable })));
    console.log(`geschreven: icons/${name}`);
  }
}
