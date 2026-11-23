import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { fromFen, makeMove, toFen } from '../../src/chess/position.js';
import { generateLegalMoves } from '../../src/chess/movegen.js';
import { gameStatus } from '../../src/chess/status.js';
import { moveToUci, moveFromUci } from '../../src/chess/notation.js';
import { createRandom } from '../../src/engine/random.js';
import { search, isDraw, MATE } from '../../src/engine/search.js';
import { PERFT_FENS } from '../chess/fixtures.js';

const best = (fen, depth, seed = 1) => {
  const result = search(fromFen(fen), { depth, random: createRandom(seed) });
  return { ...result, uci: moveToUci(result.move) };
};

function play(pos, moves) {
  for (const uci of moves.split(' ')) makeMove(pos, moveFromUci(pos, uci));
  return pos;
}

test('createRandom geeft met dezelfde seed dezelfde reeks in [0, 1)', () => {
  const a = createRandom(42);
  const b = createRandom(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('mat in 1 wordt gevonden', () => {
  const result = best('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 3);
  assert.equal(result.uci, 'a1a8');
  assert.equal(result.score, MATE - 1);
});

test('mat in 2 wordt gevonden', () => {
  const result = best('r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 0 1', 4);
  assert.equal(result.uci, 'd5d8');
  assert.equal(result.score, MATE - 3);
});

test('een paardvork wint de dame', () => {
  assert.equal(best('q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 3).uci, 'b5c7');
});

test('de dame slaat geen gedekte pion', () => {
  assert.notEqual(best('4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1', 2).uci, 'd1d5');
});

test('wie wint, geeft geen pat', () => {
  const pos = fromFen('7k/5Q2/8/8/8/8/8/K7 w - - 0 1');
  const { move } = search(pos, { depth: 3, random: createRandom(1) });
  makeMove(pos, move);
  assert.notEqual(gameStatus(pos).result, 'stalemate');
});

test('een pion promoveert tot dame', () => {
  assert.equal(best('4k3/8/8/8/8/8/p7/4K3 b - - 0 1', 2).uci, 'a2a1q');
});

test('ook in een verloren stelling komt de enige zet terug', () => {
  const result = best('8/8/8/8/8/5k2/8/r6K w - - 0 1', 3);
  assert.equal(result.uci, 'h1h2');
  assert.ok(result.score < 0);
});

test('zonder legale zetten is er geen zet', () => {
  const result = search(fromFen('k7/8/1Q6/8/8/8/8/K7 b - - 0 1'), { depth: 3 });
  assert.equal(result.move, null);
  assert.equal(result.score, 0);
});

test('isDraw herkent een herhaalde stelling', () => {
  const pos = fromFen(START_FEN);
  assert.equal(isDraw(pos), false);
  play(pos, 'g1f3 g8f6 f3g1 f6g8');
  assert.equal(isDraw(pos), true);
});

test('wie voor staat, ontwijkt een herhaling', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const pos = play(
      fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1'),
      'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1',
    );
    const { move } = search(pos, { depth: 2, random: createRandom(seed) });
    assert.notEqual(moveToUci(move), 'f6g8', `seed ${seed}`);
  }
});

test('na het zoeken is de stelling onveranderd', () => {
  const pos = fromFen(PERFT_FENS.kiwipete);
  const before = { fen: toFen(pos), lo: pos.hashLo, hi: pos.hashHi, history: pos.history.length };
  const { nodes } = search(pos, { depth: 3, random: createRandom(1) });
  assert.deepEqual({ fen: toFen(pos), lo: pos.hashLo, hi: pos.hashHi, history: pos.history.length }, before);
  assert.ok(nodes > 0);
});

test('de engine speelt alleen legale zetten', () => {
  const pos = fromFen(START_FEN);
  const random = createRandom(7);
  for (let i = 0; i < 20; i++) {
    const legal = generateLegalMoves(pos);
    const { move } = search(pos, { depth: 2, random });
    assert.ok(legal.includes(move), `zet ${i + 1}: ${moveToUci(move)}`);
    makeMove(pos, move);
  }
});
