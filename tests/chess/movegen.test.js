import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { squareFromName as sq, moveFrom, moveTo } from '../../src/chess/constants.js';
import { fromFen, toFen, makeMove, unmakeMove } from '../../src/chess/position.js';
import { computeHash } from '../../src/chess/zobrist.js';
import { generateLegalMoves, isInCheck } from '../../src/chess/movegen.js';
import { perft } from '../../src/chess/perft.js';
import { PERFT_FENS } from './fixtures.js';

const PERFT_EXPECTED = {
  start: [20, 400, 8902, 197281],
  kiwipete: [48, 2039, 97862],
  pos3: [14, 191, 2812, 43238],
  pos4: [6, 264, 9467],
  pos5: [44, 1486, 62379],
  pos6: [46, 2079, 89890],
};

const hasMove = (moves, from, to) =>
  moves.some((m) => moveFrom(m) === sq(from) && moveTo(m) === sq(to));

test('in de beginstelling zijn er 20 legale zetten', () => {
  assert.equal(generateLegalMoves(fromFen(START_FEN)).length, 20);
});

for (const [name, counts] of Object.entries(PERFT_EXPECTED)) {
  counts.forEach((expected, index) => {
    const depth = index + 1;
    test(`perft ${name} diepte ${depth} = ${expected}`, () => {
      assert.equal(perft(fromFen(PERFT_FENS[name]), depth), expected);
    });
  });
}

test('schaak wordt herkend', () => {
  assert.equal(isInCheck(fromFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), true);
  assert.equal(isInCheck(fromFen(START_FEN)), false);
});

test('rokeren terwijl je schaak staat kan niet', () => {
  const moves = generateLegalMoves(fromFen('r3k2r/8/8/8/1b6/8/8/R3K2R w KQkq - 0 1'));
  assert.equal(hasMove(moves, 'e1', 'g1'), false);
  assert.equal(hasMove(moves, 'e1', 'c1'), false);
});

test('rokeren over een aangevallen veld kan niet, de andere kant wel', () => {
  const moves = generateLegalMoves(fromFen('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1'));
  assert.equal(hasMove(moves, 'e1', 'g1'), false);
  assert.equal(hasMove(moves, 'e1', 'c1'), true);
});

test('lange reeks zetten: hash blijft kloppen en alles draait exact terug', () => {
  const pos = fromFen(PERFT_FENS.kiwipete);
  let played = 0;
  for (let i = 0; i < 300; i++) {
    const legal = generateLegalMoves(pos);
    if (legal.length === 0) break;
    makeMove(pos, legal[(i * 7 + 3) % legal.length]);
    played += 1;
    assert.deepEqual([pos.hashLo, pos.hashHi], computeHash(pos), `hash na zet ${played}`);
  }
  assert.ok(played > 20, `te weinig zetten gespeeld: ${played}`);
  for (let i = 0; i < played; i++) unmakeMove(pos);
  assert.equal(toFen(pos), PERFT_FENS.kiwipete);
});
