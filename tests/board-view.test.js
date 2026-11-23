import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squareOrder, isLightSquare, pieceImage, pieceName } from '../src/board-view.js';

test('met wit onderaan begint het bord linksboven bij a8', () => {
  const order = squareOrder('white');
  assert.equal(order.length, 64);
  assert.equal(order[0], 'a8');
  assert.equal(order[7], 'h8');
  assert.equal(order[56], 'a1');
  assert.equal(order[63], 'h1');
});

test('met zwart onderaan is het bord gedraaid: h1 linksboven', () => {
  const order = squareOrder('black');
  assert.equal(order.length, 64);
  assert.equal(order[0], 'h1');
  assert.equal(order[7], 'a1');
  assert.equal(order[56], 'h8');
  assert.equal(order[63], 'a8');
});

test('elk veld komt in beide richtingen precies één keer voor', () => {
  assert.equal(new Set(squareOrder('white')).size, 64);
  assert.equal(new Set(squareOrder('black')).size, 64);
});

test('a1 is donker, h1 is licht', () => {
  assert.equal(isLightSquare('a1'), false);
  assert.equal(isLightSquare('h1'), true);
  assert.equal(isLightSquare('a8'), true);
  assert.equal(isLightSquare('e4'), true);
  assert.equal(isLightSquare('d4'), false);
});

test('de plaatjes van de stukken hebben een relatief pad', () => {
  assert.equal(pieceImage('K'), 'assets/pieces/wK.svg');
  assert.equal(pieceImage('p'), 'assets/pieces/bP.svg');
  for (const piece of 'KQRBNPkqrbnp') {
    assert.equal(pieceImage(piece).startsWith('/'), false, piece);
  }
});

test('de stukken hebben Nederlandse namen met het juiste lidwoord', () => {
  assert.equal(pieceName('Q'), 'witte dame');
  assert.equal(pieceName('n'), 'zwart paard');
  assert.equal(pieceName('b'), 'zwarte loper');
  assert.equal(pieceName('K'), 'witte koning');
  assert.equal(pieceName('N'), 'wit paard');
});
