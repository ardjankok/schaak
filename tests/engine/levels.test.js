import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { fromFen } from '../../src/chess/position.js';
import { generateLegalMoves } from '../../src/chess/movegen.js';
import { moveToUci } from '../../src/chess/notation.js';
import { createRandom } from '../../src/engine/random.js';
import { LEVELS, chooseMove } from '../../src/engine/levels.js';

const pick = (fen, level, seed, options = {}) =>
  moveToUci(chooseMove(fromFen(fen), level, { random: createRandom(seed), ...options }).move);

const HANGING_QUEEN = '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1';
const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
const COVERED_PAWN = '4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1';

test('er zijn vijf niveaus, op volgorde, elk met een naam', () => {
  assert.equal(LEVELS.length, 5);
  LEVELS.forEach((entry, index) => {
    assert.equal(entry.level, index + 1);
    assert.ok(entry.name.length > 0);
  });
});

test('niveau 1 slaat een hangende dame', () => {
  let taken = 0;
  for (let seed = 1; seed <= 20; seed++) if (pick(HANGING_QUEEN, 1, seed) === 'd2d5') taken += 1;
  assert.ok(taken >= 18, `${taken} van 20`);
});

test('niveau 1 zet mat in 1', () => {
  for (let seed = 1; seed <= 20; seed++) assert.equal(pick(MATE_IN_ONE, 1, seed), 'a1a8', `seed ${seed}`);
});

test('niveau 1 speelt gevarieerd', () => {
  const moves = new Set();
  for (let seed = 1; seed <= 50; seed++) moves.add(pick(START_FEN, 1, seed));
  assert.ok(moves.size >= 8, `${moves.size} verschillende zetten`);
});

test('niveau 1 maakt soms een fout, niveau 3 niet', () => {
  let level1 = 0;
  let level3 = 0;
  for (let seed = 1; seed <= 100; seed++) {
    if (pick(COVERED_PAWN, 1, seed) === 'd1d5') level1 += 1;
    if (pick(COVERED_PAWN, 3, seed) === 'd1d5') level3 += 1;
  }
  assert.ok(level1 >= 3, `niveau 1: ${level1} keer`);
  assert.equal(level3, 0);
});

test('niveau 4 en 5 zoeken binnen de tijd en geven een legale zet', () => {
  for (const level of [4, 5]) {
    const pos = fromFen(START_FEN);
    const { move } = chooseMove(pos, level, { random: createRandom(1), timeScale: 0.05 });
    assert.ok(generateLegalMoves(pos).includes(move), `niveau ${level}`);
  }
});

test('een onbekend niveau geeft een fout', () => {
  assert.throws(() => chooseMove(fromFen(START_FEN), 6), { message: 'Onbekend niveau: 6' });
  assert.throws(() => chooseMove(fromFen(START_FEN), 0), { message: 'Onbekend niveau: 0' });
});

test('zonder legale zetten geeft elk niveau geen zet', () => {
  for (const { level } of LEVELS) {
    assert.equal(chooseMove(fromFen('k7/8/1Q6/8/8/8/8/K7 b - - 0 1'), level, { timeScale: 0.05 }).move, null);
  }
});
