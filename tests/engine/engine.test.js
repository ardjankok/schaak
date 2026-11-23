import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { toFen } from '../../src/chess/position.js';
import { generateLegalMoves } from '../../src/chess/movegen.js';
import { moveToUci } from '../../src/chess/notation.js';
import { positionFromMoves, handleRequest } from '../../src/engine/engine.js';

test('positionFromMoves speelt de zetten na vanaf de beginstelling', () => {
  const pos = positionFromMoves(START_FEN, ['e2e4', 'e7e5']);
  assert.equal(toFen(pos), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2');
  assert.equal(pos.history.length, 2);
});

test('positionFromMoves weigert een illegale zet', () => {
  assert.throws(() => positionFromMoves(START_FEN, ['e2e5']), { message: 'Ongeldige zet: e2e5' });
});

test('handleRequest geeft een legale zet voor de speler aan zet', () => {
  const request = { id: 7, startFen: START_FEN, moves: ['e2e4'], level: 2, seed: 3 };
  const answer = handleRequest(request);
  assert.equal(answer.id, 7);
  const legal = generateLegalMoves(positionFromMoves(START_FEN, ['e2e4'])).map(moveToUci);
  assert.ok(legal.includes(answer.move), answer.move);
  assert.deepEqual(handleRequest(request), answer);
});

test('handleRequest meldt een illegale zet als fout', () => {
  assert.deepEqual(
    handleRequest({ id: 8, startFen: START_FEN, moves: ['e2e5'], level: 2 }),
    { id: 8, error: 'Ongeldige zet: e2e5' },
  );
});

test('handleRequest meldt een ongeldige stelling als fout, zonder te gooien', () => {
  const answer = handleRequest({ id: 9, startFen: 'nonsens', moves: [], level: 2 });
  assert.equal(answer.id, 9);
  assert.match(answer.error, /Ongeldige FEN/);
});

test('handleRequest vindt mat in 1', () => {
  const answer = handleRequest({ id: 1, startFen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', moves: [], level: 5, timeScale: 0.05 });
  assert.equal(answer.move, 'a1a8');
});

test('handleRequest meldt een onbekend of ontbrekend niveau als fout', () => {
  assert.deepEqual(
    handleRequest({ id: 3, startFen: START_FEN, moves: [], level: 9 }),
    { id: 3, error: 'Onbekend niveau: 9' },
  );
  const answer = handleRequest({ id: 4, startFen: START_FEN, moves: [] });
  assert.equal(answer.id, 4);
  assert.ok(answer.error);
});

test('handleRequest gooit nooit, ook niet zonder verzoek', () => {
  const answer = handleRequest(undefined);
  assert.equal(answer.id, undefined);
  assert.ok(answer.error);
});
