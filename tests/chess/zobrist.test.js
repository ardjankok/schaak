import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_KEYS, CASTLING_KEYS, EP_KEYS, SIDE_KEY } from '../../src/chess/zobrist.js';

// Rang over GF(2): hoeveel van de 64 bits de sleutels echt onafhankelijk vullen.
// Bij 64 heeft de hoge helft eigen informatie; bij 32 is hi een functie van lo.
function gf2Rank(keys) {
  const basis = new Array(64).fill(0n);
  let rank = 0;
  for (let key of keys) {
    for (let bit = 63; bit >= 0 && key; bit--) {
      if (!((key >> BigInt(bit)) & 1n)) continue;
      if (basis[bit]) {
        key ^= basis[bit];
      } else {
        basis[bit] = key;
        rank += 1;
        break;
      }
    }
  }
  return rank;
}

test('de Zobrist-sleutels gebruiken alle 64 bits', () => {
  const keys = [];
  for (const table of [PIECE_KEYS, CASTLING_KEYS, EP_KEYS, SIDE_KEY]) {
    for (let i = 0; i < table.lo.length; i++) {
      keys.push((BigInt(table.hi[i] >>> 0) << 32n) | BigInt(table.lo[i] >>> 0));
    }
  }
  assert.equal(gf2Rank(keys), 64);
});
