import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { fromFen, makeMove } from '../../src/chess/position.js';
import { gameStatus, countRepetitions } from '../../src/chess/status.js';
import { moveFromUci } from '../../src/chess/notation.js';

const statusOf = (fen) => gameStatus(fromFen(fen));

function play(pos, moves) {
  for (const uci of moves.split(' ')) {
    const move = moveFromUci(pos, uci);
    assert.notEqual(move, null, `zet ${uci} moet legaal zijn`);
    makeMove(pos, move);
  }
}

test('gekkenmat: zwart wint', () => {
  assert.deepEqual(
    statusOf('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'),
    { result: 'checkmate', winner: 'black' },
  );
});

test('pat', () => {
  assert.deepEqual(statusOf('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), { result: 'stalemate', winner: null });
});

test('de beginstelling is gewoon een lopende partij', () => {
  assert.deepEqual(statusOf(START_FEN), { result: 'ongoing', winner: null });
});

test('50-zettenregel: remise bij klok 100, niet bij 99', () => {
  assert.equal(statusOf('k7/8/8/8/8/8/8/K6R w - - 100 80').result, 'draw-fifty');
  assert.equal(statusOf('k7/8/8/8/8/8/8/K6R w - - 99 80').result, 'ongoing');
});

test('mat gaat voor de 50-zettenregel', () => {
  assert.deepEqual(statusOf('k7/1Q6/1K6/8/8/8/8/8 b - - 100 80'), { result: 'checkmate', winner: 'white' });
});

for (const fen of [
  'k7/8/8/8/8/8/8/K7 w - - 0 1',
  'k7/8/8/8/8/8/8/KB6 w - - 0 1',
  'k7/8/8/8/8/8/8/KN6 w - - 0 1',
  'k4b2/8/8/8/8/8/8/K1B5 w - - 0 1',
]) {
  test(`onvoldoende materiaal: ${fen}`, () => {
    assert.equal(statusOf(fen).result, 'draw-material');
  });
}

for (const fen of [
  'k3b3/8/8/8/8/8/8/K1B5 w - - 0 1',
  'k7/8/8/8/8/8/8/KNN5 w - - 0 1',
  'k7/8/8/8/8/8/P7/K7 w - - 0 1',
]) {
  test(`wel genoeg materiaal: ${fen}`, () => {
    assert.equal(statusOf(fen).result, 'ongoing');
  });
}

test('drie keer dezelfde stelling is remise, twee keer niet', () => {
  const pos = fromFen(START_FEN);
  play(pos, 'g1f3 g8f6 f3g1 f6g8');
  assert.equal(gameStatus(pos).result, 'ongoing');
  play(pos, 'g1f3 g8f6 f3g1 f6g8');
  assert.equal(gameStatus(pos).result, 'draw-repetition');
});

test('stellingen met andere rokaderechten tellen niet als herhaling', () => {
  const pos = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  play(pos, 'e1e2 e8e7 e2e1 e7e8');
  assert.equal(gameStatus(pos).result, 'ongoing', 'na ronde 1');
  play(pos, 'e1e2 e8e7 e2e1 e7e8');
  assert.equal(gameStatus(pos).result, 'ongoing', 'na ronde 2');
  play(pos, 'e1e2 e8e7 e2e1 e7e8');
  assert.equal(gameStatus(pos).result, 'draw-repetition', 'na ronde 3');
});

test('countRepetitions telt hoe vaak de huidige stelling is voorgekomen', () => {
  const pos = fromFen(START_FEN);
  assert.equal(countRepetitions(pos), 1);
  play(pos, 'g1f3 g8f6 f3g1 f6g8');
  assert.equal(countRepetitions(pos), 2);
});
