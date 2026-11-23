import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { fromFen } from '../../src/chess/position.js';
import { evaluate, PIECE_VALUES } from '../../src/engine/evaluate.js';

test('de stukwaarden zijn per stuktype vastgelegd', () => {
  assert.deepEqual(PIECE_VALUES, [0, 100, 320, 330, 500, 900, 0]);
});

test('in de beginstelling is het materiaal gelijk', () => {
  assert.equal(evaluate(fromFen(START_FEN)), 0);
});

test('de evaluatie is vanuit de speler aan zet', () => {
  assert.equal(evaluate(fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')), 900);
  assert.equal(evaluate(fromFen('4k3/8/8/8/8/8/8/3QK3 b - - 0 1')), -900);
});

test('alle stukken tellen mee', () => {
  assert.equal(evaluate(fromFen('4k3/pppp4/8/8/8/8/8/R2NK3 w - - 0 1')), 500 + 320 - 4 * 100);
});
