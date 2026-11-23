import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, describeStatus } from '../src/game.js';

const PINNED_FEN = '4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1';
const PROMOTION_FEN = 'k7/4P3/8/8/8/8/8/K7 w - - 0 1';
const CHECK_FEN = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';

/** Doet een reeks zetten door op het van- en naar-veld te tikken. */
function play(game, ...moves) {
  for (const move of moves) {
    game.tap(move.slice(0, 2));
    game.tap(move.slice(2, 4));
  }
}

test('een nieuw spel begint met wit aan zet en niets geselecteerd', () => {
  const game = new Game();
  assert.equal(game.turn, 'white');
  assert.equal(game.selected, null);
  assert.equal(game.lastMove, null);
  assert.deepEqual(game.status, { result: 'ongoing', winner: null });
  assert.equal(game.checkSquare, null);
  assert.equal(game.isOver, false);
  assert.equal(game.statusText(), 'Wit is aan zet');
});

test('tik op een eigen stuk selecteert het en toont de doelvelden', () => {
  const game = new Game();
  assert.equal(game.tap('e2'), 'selected');
  assert.equal(game.selected, 'e2');
  assert.deepEqual(game.targets(), ['e3', 'e4']);
});

test('zonder selectie doet tikken op een stuk van de tegenstander of een leeg veld niets', () => {
  const game = new Game();
  assert.equal(game.tap('e7'), 'ignored');
  assert.equal(game.tap('e4'), 'ignored');
  assert.equal(game.selected, null);
  assert.deepEqual(game.targets(), []);
});

test('tik op een doelveld doet de zet', () => {
  const game = new Game();
  game.tap('e2');
  assert.equal(game.tap('e4'), 'moved');
  assert.equal(game.turn, 'black');
  assert.deepEqual(game.lastMove, { from: 'e2', to: 'e4' });
  assert.equal(game.pieces().e4, 'P');
  assert.equal('e2' in game.pieces(), false);
  assert.equal(game.selected, null);
  assert.equal(game.statusText(), 'Zwart is aan zet');
});

test('tik op een veld waar het stuk niet heen kan heft de selectie op zonder zet', () => {
  const game = new Game();
  game.tap('e2');
  assert.equal(game.tap('e5'), 'deselected');
  assert.equal(game.selected, null);
  assert.equal(game.pieces().e2, 'P');
  assert.equal(game.turn, 'white');
});

test('tik op een ander eigen stuk selecteert dat stuk', () => {
  const game = new Game();
  game.tap('e2');
  assert.equal(game.tap('d2'), 'selected');
  assert.equal(game.selected, 'd2');
});

test('nog een keer tikken op het geselecteerde stuk heft de selectie op', () => {
  const game = new Game();
  game.tap('e2');
  assert.equal(game.tap('e2'), 'deselected');
  assert.equal(game.selected, null);
});

test('een gepend stuk kun je selecteren, maar het heeft geen doelvelden', () => {
  const game = new Game(PINNED_FEN);
  assert.equal(game.tap('e2'), 'selected');
  assert.deepEqual(game.targets(), []);
  assert.equal(game.tap('a1'), 'deselected');
  assert.equal(game.selected, null);
});

test('promotie wacht op een keuze en zet dan het gekozen stuk neer', () => {
  const game = new Game(PROMOTION_FEN);
  game.tap('e7');
  // Vier promotiezetten naar e8, maar het doelveld komt één keer voor.
  assert.deepEqual(game.targets(), ['e8']);
  assert.equal(game.tap('e8'), 'promotion');
  assert.deepEqual(game.pendingPromotion, { from: 'e7', to: 'e8' });
  assert.equal(game.pieces().e7, 'P');

  assert.equal(game.tap('a1'), 'ignored');
  assert.equal(game.choosePromotion('x'), false);
  assert.deepEqual(game.pendingPromotion, { from: 'e7', to: 'e8' });

  assert.equal(game.choosePromotion('n'), true);
  assert.equal(game.pieces().e8, 'N');
  assert.equal('e7' in game.pieces(), false);
  assert.equal(game.turn, 'black');
  assert.equal(game.pendingPromotion, null);
  assert.equal(game.selected, null);
  assert.deepEqual(game.lastMove, { from: 'e7', to: 'e8' });
});

test('promotie annuleren laat de partij gewoon doorgaan', () => {
  const game = new Game(PROMOTION_FEN);
  game.tap('e7');
  game.tap('e8');
  game.cancelPromotion();
  assert.equal(game.pendingPromotion, null);
  assert.equal(game.selected, null);
  assert.equal(game.turn, 'white');
  assert.equal(game.pieces().e7, 'P');
  assert.equal(game.tap('a1'), 'selected');
});

test('zonder promotie die wacht doet choosePromotion niets', () => {
  const game = new Game();
  assert.equal(game.choosePromotion('q'), false);
  assert.equal(game.turn, 'white');
});

test('gekkenmat met tikken: zwart wint en daarna doet tikken niets', () => {
  const game = new Game();
  play(game, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.deepEqual(game.status, { result: 'checkmate', winner: 'black' });
  assert.equal(game.isOver, true);
  assert.equal(game.checkSquare, 'e1');
  assert.equal(game.statusText(), 'Schaakmat! Zwart wint');
  assert.equal(game.tap('e1'), 'ignored');
  assert.equal(game.selected, null);
});

test('schaak wordt gemeld en de koning die schaak staat is bekend', () => {
  const game = new Game(CHECK_FEN);
  play(game, 'a1a8');
  assert.equal(game.checkSquare, 'e8');
  assert.equal(game.statusText(), 'Schaak! Zwart is aan zet');
});

test('reset zet de beginstelling terug', () => {
  const game = new Game();
  play(game, 'e2e4', 'e7e5');
  game.tap('g1');
  game.reset();
  assert.equal(Object.keys(game.pieces()).length, 32);
  assert.equal(game.turn, 'white');
  assert.equal(game.lastMove, null);
  assert.equal(game.selected, null);
  assert.equal(game.statusText(), 'Wit is aan zet');
});

test('describeStatus geeft voor elke situatie de juiste tekst', () => {
  const ongoing = { result: 'ongoing', winner: null };
  const cases = [
    [ongoing, 'white', false, 'Wit is aan zet'],
    [ongoing, 'black', false, 'Zwart is aan zet'],
    [ongoing, 'white', true, 'Schaak! Wit is aan zet'],
    [ongoing, 'black', true, 'Schaak! Zwart is aan zet'],
    [{ result: 'checkmate', winner: 'white' }, 'black', true, 'Schaakmat! Wit wint'],
    [{ result: 'checkmate', winner: 'black' }, 'white', true, 'Schaakmat! Zwart wint'],
    [{ result: 'stalemate', winner: null }, 'white', false, 'Pat: remise'],
    [{ result: 'draw-fifty', winner: null }, 'white', false, 'Remise: 50 zetten zonder slag of pionzet'],
    [{ result: 'draw-repetition', winner: null }, 'black', false, 'Remise: drie keer dezelfde stelling'],
    [{ result: 'draw-material', winner: null }, 'white', false, 'Remise: te weinig materiaal om mat te zetten'],
  ];
  for (const [status, turn, inCheck, expected] of cases) {
    assert.equal(describeStatus(status, turn, inCheck), expected, `${status.result} ${turn} ${inCheck}`);
  }
});
