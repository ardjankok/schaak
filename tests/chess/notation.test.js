import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { FLAG_CASTLE, KNIGHT, moveFlags, movePromotion } from '../../src/chess/constants.js';
import { fromFen } from '../../src/chess/position.js';
import { moveToUci, moveFromUci } from '../../src/chess/notation.js';

const PROMOTION_FEN = 'r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1';

test('een zet heen en terug als tekst', () => {
  assert.equal(moveToUci(moveFromUci(fromFen(START_FEN), 'e2e4')), 'e2e4');
});

test('rokade wordt herkend', () => {
  const move = moveFromUci(fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1g1');
  assert.notEqual(move, null);
  assert.equal(moveFlags(move) & FLAG_CASTLE, FLAG_CASTLE);
});

test('promotie naar paard wordt herkend', () => {
  const move = moveFromUci(fromFen(PROMOTION_FEN), 'b7a8n');
  assert.notEqual(move, null);
  assert.equal(movePromotion(move), KNIGHT);
  assert.equal(moveToUci(move), 'b7a8n');
});

for (const input of ['e2e5', '', 'zz', 'e2e9', 'e2e4x', undefined]) {
  test(`onzin of illegale invoer geeft null: ${JSON.stringify(input)}`, () => {
    assert.equal(moveFromUci(fromFen(START_FEN), input), null);
  });
}

test('promotie zonder stukkeuze geeft null', () => {
  assert.equal(moveFromUci(fromFen(PROMOTION_FEN), 'b7a8'), null);
});
