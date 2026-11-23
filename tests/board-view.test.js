import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squareOrder, isLightSquare, pieceImage, pieceName, squareClasses, squareLabel } from '../src/board-view.js';

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

const PIECES = { e2: 'P', d7: 'p' };

test('een veld zonder markering heeft alleen zijn kleur', () => {
  assert.deepEqual(squareClasses('a1', { pieces: PIECES }), ['square', 'dark']);
  assert.deepEqual(squareClasses('h1', { pieces: PIECES }), ['square', 'light']);
});

test('het geselecteerde veld wordt gemarkeerd', () => {
  assert.ok(squareClasses('e2', { pieces: PIECES, selected: 'e2' }).includes('selected'));
  assert.ok(!squareClasses('e3', { pieces: PIECES, selected: 'e2' }).includes('selected'));
});

test('een leeg doelveld krijgt een stip, geen ring', () => {
  const classes = squareClasses('e4', { pieces: PIECES, targets: ['e3', 'e4'] });
  assert.ok(classes.includes('target'));
  assert.ok(!classes.includes('capture'));
  assert.ok(!squareClasses('e5', { pieces: PIECES, targets: ['e3', 'e4'] }).includes('target'));
});

test('een doelveld met een stuk erop wordt een slagveld', () => {
  const classes = squareClasses('d7', { pieces: PIECES, targets: ['d7'] });
  assert.ok(classes.includes('target'));
  assert.ok(classes.includes('capture'));
});

test('van- en naar-veld van de laatste zet worden gemarkeerd', () => {
  const lastMove = { from: 'e2', to: 'e4' };
  assert.ok(squareClasses('e2', { pieces: PIECES, lastMove }).includes('last-move'));
  assert.ok(squareClasses('e4', { pieces: PIECES, lastMove }).includes('last-move'));
  assert.ok(!squareClasses('e3', { pieces: PIECES, lastMove }).includes('last-move'));
});

test('de koning die schaak staat wordt gemarkeerd', () => {
  assert.ok(squareClasses('e1', { pieces: PIECES, check: 'e1' }).includes('check'));
  assert.ok(!squareClasses('e1', { pieces: PIECES, check: null }).includes('check'));
});

test('elk veld heeft een voorleestekst met veldnaam en stuk', () => {
  assert.equal(squareLabel('e2', PIECES), 'e2, witte pion');
  assert.equal(squareLabel('e4', PIECES), 'e4');
});
