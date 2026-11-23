import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, boardFromFen } from '../src/fen.js';

test('de beginstelling heeft 32 stukken', () => {
  assert.equal(Object.keys(boardFromFen(START_FEN)).length, 32);
});

test('de stukken op de achterste rijen staan goed', () => {
  const board = boardFromFen(START_FEN);
  const expected = {
    e1: 'K', d1: 'Q', e8: 'k', d8: 'q', a1: 'R', h8: 'r',
    b1: 'N', g8: 'n', c1: 'B', f8: 'b',
  };
  for (const [square, piece] of Object.entries(expected)) {
    assert.equal(board[square], piece, `veld ${square}`);
  }
});

test('alle pionnen staan op rij 2 en 7', () => {
  const board = boardFromFen(START_FEN);
  for (const file of 'abcdefgh') {
    assert.equal(board[`${file}2`], 'P', `veld ${file}2`);
    assert.equal(board[`${file}7`], 'p', `veld ${file}7`);
  }
});

test('lege velden staan er niet in', () => {
  assert.equal('e4' in boardFromFen(START_FEN), false);
});

test('een enkele koning op e4 wordt goed gelezen', () => {
  assert.deepEqual(boardFromFen('8/8/8/8/4K3/8/8/8 w - - 0 1'), { e4: 'K' });
});

for (const fen of [
  '',
  '8/8/8/8/8/8/8 w - - 0 1',
  '9/8/8/8/8/8/8/8 w - - 0 1',
  '7/8/8/8/8/8/8/8 w - - 0 1',
  '8/8/8/8/8/8/8/7X w - - 0 1',
]) {
  test(`ongeldige FEN geeft een duidelijke fout: "${fen}"`, () => {
    assert.throws(() => boardFromFen(fen), { message: /^Ongeldige FEN/ });
  });
}
