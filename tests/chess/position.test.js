import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, boardFromFen } from '../../src/fen.js';
import {
  squareFromName, squareName, encodeMove, moveFrom, moveTo, moveFlags, movePromotion,
  FLAG_CAPTURE, QUEEN,
} from '../../src/chess/constants.js';
import { fromFen, toFen, boardFromPosition } from '../../src/chess/position.js';
import { computeHash } from '../../src/chess/zobrist.js';
import { PERFT_FENS } from './fixtures.js';

const hashOf = (fen) => {
  const pos = fromFen(fen);
  return [pos.hashLo, pos.hashHi];
};

test('veldnamen worden 0x88-indexen en terug', () => {
  assert.equal(squareFromName('a1'), 0);
  assert.equal(squareFromName('h1'), 7);
  assert.equal(squareFromName('e4'), 52);
  assert.equal(squareFromName('a8'), 112);
  assert.equal(squareFromName('h8'), 119);
  for (const file of 'abcdefgh') {
    for (const rank of '12345678') {
      assert.equal(squareName(squareFromName(file + rank)), file + rank);
    }
  }
});

test('een zet als getal bewaart van, naar, vlaggen en promotie', () => {
  const move = encodeMove(100, 116, FLAG_CAPTURE, QUEEN);
  assert.equal(moveFrom(move), 100);
  assert.equal(moveTo(move), 116);
  assert.equal(moveFlags(move), FLAG_CAPTURE);
  assert.equal(movePromotion(move), QUEEN);
});

for (const [name, fen] of Object.entries(PERFT_FENS)) {
  test(`FEN heen en terug: ${name}`, () => {
    assert.equal(toFen(fromFen(fen)), fen);
  });
  test(`hash klopt met volledige herberekening: ${name}`, () => {
    const pos = fromFen(fen);
    assert.deepEqual([pos.hashLo, pos.hashHi], computeHash(pos));
  });
}

test('ontbrekende klokken krijgen 0 en 1', () => {
  assert.equal(toFen(fromFen('8/8/8/8/4K3/8/8/k7 w - -')), '8/8/8/8/4K3/8/8/k7 w - - 0 1');
});

test('boardFromPosition geeft hetzelfde als boardFromFen', () => {
  assert.deepEqual(boardFromPosition(fromFen(START_FEN)), boardFromFen(START_FEN));
});

test('de koningsvelden worden bijgehouden', () => {
  assert.deepEqual([...fromFen(START_FEN).kings], [squareFromName('e1'), squareFromName('e8')]);
});

for (const fen of [
  '8/8/8/8/8/8/8/k7 w - - 0 1',
  'K7/8/8/8/8/8/8/k6K w - - 0 1',
  'k7/8/8/8/8/8/8/K7 x - - 0 1',
  'k7/8/8/8/8/8/8/K7 w X - 0 1',
  'k7/8/8/8/8/8/8/K7 w - e4 0 1',
  'k7/8/8/8/8/8/8/K7 w - - -1 1',
]) {
  test(`ongeldige stelling geeft een fout: "${fen}"`, () => {
    assert.throws(() => fromFen(fen), { message: /^Ongeldige FEN/ });
  });
}

test('dezelfde stelling geeft dezelfde hash', () => {
  assert.deepEqual(hashOf(START_FEN), hashOf(START_FEN));
});

test('wie aan zet is telt mee in de hash', () => {
  assert.notDeepEqual(hashOf(START_FEN), hashOf(START_FEN.replace(' w ', ' b ')));
});

test('rokaderechten tellen mee in de hash', () => {
  assert.notDeepEqual(hashOf(START_FEN), hashOf(START_FEN.replace(' KQkq ', ' - ')));
});

test('een en-passantveld zonder slagmogelijkheid telt niet mee in de hash', () => {
  const withEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  assert.deepEqual(hashOf(withEp), hashOf(withEp.replace(' e3 ', ' - ')));
});

test('een en-passantveld met slagmogelijkheid telt wel mee in de hash', () => {
  const withEp = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  assert.notDeepEqual(hashOf(withEp), hashOf(withEp.replace(' e3 ', ' - ')));
});
