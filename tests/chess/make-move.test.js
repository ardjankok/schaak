import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import {
  encodeMove, squareFromName as sq, KNIGHT,
  FLAG_CAPTURE, FLAG_DOUBLE_PUSH, FLAG_EN_PASSANT, FLAG_CASTLE,
} from '../../src/chess/constants.js';
import { fromFen, toFen, makeMove, unmakeMove } from '../../src/chess/position.js';
import { computeHash } from '../../src/chess/zobrist.js';

function checkMove(name, before, move, after) {
  test(name, () => {
    const pos = fromFen(before);
    const startHash = [pos.hashLo, pos.hashHi];

    makeMove(pos, move);
    assert.equal(toFen(pos), after, 'stelling na de zet');
    assert.deepEqual([pos.hashLo, pos.hashHi], computeHash(pos), 'hash na de zet');

    unmakeMove(pos);
    assert.equal(toFen(pos), before, 'stelling na terugdraaien');
    assert.deepEqual([pos.hashLo, pos.hashHi], startHash, 'hash na terugdraaien');
  });
}

checkMove(
  'dubbele pionzet e2e4',
  START_FEN,
  encodeMove(sq('e2'), sq('e4'), FLAG_DOUBLE_PUSH),
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
);

checkMove(
  'paardzet g1f3',
  START_FEN,
  encodeMove(sq('g1'), sq('f3')),
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
);

checkMove(
  'korte rokade wit',
  'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
  encodeMove(sq('e1'), sq('g1'), FLAG_CASTLE),
  'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1',
);

checkMove(
  'lange rokade zwart',
  'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
  encodeMove(sq('e8'), sq('c8'), FLAG_CASTLE),
  '2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 2',
);

checkMove(
  'en passant e5xd6',
  'k7/8/8/3pP3/8/8/8/K7 w - d6 0 1',
  encodeMove(sq('e5'), sq('d6'), FLAG_EN_PASSANT | FLAG_CAPTURE),
  'k7/8/3P4/8/8/8/8/K7 b - - 0 1',
);

checkMove(
  'promotie met slag b7xa8=paard',
  'r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1',
  encodeMove(sq('b7'), sq('a8'), FLAG_CAPTURE, KNIGHT),
  'N3k3/8/8/8/8/8/8/4K3 b - - 0 1',
);

checkMove(
  'toren slaat toren op h8: beide verliezen een rokaderecht',
  'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
  encodeMove(sq('h1'), sq('h8'), FLAG_CAPTURE),
  'r3k2R/8/8/8/8/8/8/R3K3 b Qq - 0 1',
);

test('koningsveld wordt bijgehouden bij rokade en teruggezet', () => {
  const pos = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  makeMove(pos, encodeMove(sq('e1'), sq('g1'), FLAG_CASTLE));
  assert.equal(pos.kings[0], sq('g1'));
  unmakeMove(pos);
  assert.equal(pos.kings[0], sq('e1'));
});
