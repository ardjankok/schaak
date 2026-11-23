import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { fromFen, makeMove, unmakeMove, toFen } from '../../src/chess/position.js';
import { generateLegalMoves } from '../../src/chess/movegen.js';
import { gameStatus } from '../../src/chess/status.js';
import { moveToUci, moveFromUci } from '../../src/chess/notation.js';
import { createRandom } from '../../src/engine/random.js';
import { search, scoreMoves, MATE } from '../../src/engine/search.js';
import { search as searchV1 } from '../../src/engine/search-v1.js';
import { PERFT_FENS } from '../chess/fixtures.js';

const best = (fen, options) => {
  const result = search(fromFen(fen), { random: createRandom(1), ...options });
  return { ...result, uci: moveToUci(result.move) };
};

function play(pos, moves) {
  for (const uci of moves.split(' ')) makeMove(pos, moveFromUci(pos, uci));
  return pos;
}

const snapshot = (pos) => ({ fen: toFen(pos), lo: pos.hashLo, hi: pos.hashHi, history: pos.history.length });

function mateInOneFor(pos) {
  return generateLegalMoves(pos).some((move) => {
    makeMove(pos, move);
    const mate = gameStatus(pos).result === 'checkmate';
    unmakeMove(pos);
    return mate;
  });
}

const BACK_RANK = '4r1k1/5ppp/8/8/8/R7/5PPP/6K1 w - - 0 1';
const COVERED_PAWN = '4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1';

test('mat in 1', () => {
  const result = best('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { maxDepth: 2 });
  assert.equal(result.uci, 'a1a8');
  assert.equal(result.score, MATE - 1);
});

test('mat in 2, ook via de transpositietabel', () => {
  const result = best('r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 0 1', { maxDepth: 5 });
  assert.equal(result.uci, 'd5d8');
  assert.equal(result.score, MATE - 3);
});

test('een matdreiging achter de onderste rij wordt gezien', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const pos = fromFen(BACK_RANK);
    const { move } = search(pos, { maxDepth: 2, random: createRandom(seed) });
    makeMove(pos, move);
    assert.equal(mateInOneFor(pos), false, `seed ${seed}: ${moveToUci(move)}`);
  }
});

test('versie 1 ziet die matdreiging op diepte 2 niet altijd', () => {
  const missed = [];
  for (let seed = 1; seed <= 10; seed++) {
    const pos = fromFen(BACK_RANK);
    const { move } = searchV1(pos, { depth: 2, random: createRandom(seed) });
    makeMove(pos, move);
    if (mateInOneFor(pos)) missed.push(moveToUci(move));
  }
  assert.ok(missed.length > 0, 'v1 zou hier soms mat moeten toelaten');
});

test('quiescence: de dame slaat geen gedekte pion, ook niet op diepte 1', () => {
  const result = best(COVERED_PAWN, { maxDepth: 1 });
  assert.notEqual(result.uci, 'd1d5');
  assert.ok(Math.abs(result.score - 700) <= 100, String(result.score));
});

test('een paardvork wint de dame', () => {
  const result = best('q3k3/8/8/1N6/8/8/7P/4K3 w - - 0 1', { maxDepth: 4 });
  assert.equal(result.uci, 'b5c7');
  assert.ok(result.score > 300, String(result.score));
});

test('een pion promoveert tot dame', () => {
  assert.equal(best('4k3/8/8/8/8/8/p7/4K3 b - - 0 1', { maxDepth: 3 }).uci, 'a2a1q');
});

test('wie wint, geeft geen pat', () => {
  const pos = fromFen('7k/5Q2/8/8/8/8/8/K7 w - - 0 1');
  const { move } = search(pos, { maxDepth: 3, random: createRandom(1) });
  makeMove(pos, move);
  assert.notEqual(gameStatus(pos).result, 'stalemate');
});

test('wie voor staat, ontwijkt een herhaling', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const pos = play(
      fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1'),
      'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1',
    );
    const { move } = search(pos, { maxDepth: 3, random: createRandom(seed) });
    assert.notEqual(moveToUci(move), 'f6g8', `seed ${seed}`);
  }
});

test('dame tegen koning wordt mat', () => {
  const pos = fromFen('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
  const white = createRandom(3);
  const black = createRandom(4);
  let plies = 0;
  while (gameStatus(pos).result === 'ongoing' && plies < 60) {
    const options = pos.turn === 0 ? { timeMs: 100, random: white } : { maxDepth: 2, random: black };
    makeMove(pos, search(pos, options).move);
    plies += 1;
  }
  assert.equal(gameStatus(pos).result, 'checkmate', `na ${plies} halve zetten: ${toFen(pos)}`);
});

test('de tijdslimiet wordt gehaald en de stelling blijft gelijk', () => {
  const pos = fromFen(PERFT_FENS.kiwipete);
  const before = snapshot(pos);
  const start = performance.now();
  const result = search(pos, { timeMs: 200, random: createRandom(1) });
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 300, `${elapsed.toFixed(0)} ms`);
  assert.ok(result.depth >= 2, `diepte ${result.depth}`);
  assert.ok(generateLegalMoves(pos).includes(result.move));
  assert.deepEqual(snapshot(pos), before);
});

test('met een klok die hard loopt komt toch diepte 1 terug', () => {
  const pos = fromFen(PERFT_FENS.kiwipete);
  const before = snapshot(pos);
  let clock = 0;
  const now = () => (clock += 1000);
  const result = search(pos, { timeMs: 1, now, random: createRandom(1) });
  assert.equal(result.depth, 1);
  assert.ok(generateLegalMoves(pos).includes(result.move));
  assert.deepEqual(snapshot(pos), before);
});

test('scoreMoves geeft elke legale zet een score', () => {
  const pos = fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const scored = scoreMoves(pos, 2);
  assert.equal(scored.length, generateLegalMoves(pos).length);
  assert.equal(scored.find((s) => moveToUci(s.move) === 'a1a8').score, MATE - 1);
});

test('scoreMoves met en zonder quiescence', () => {
  const pos = fromFen(COVERED_PAWN);
  const careful = scoreMoves(pos, 1);
  const take = careful.find((s) => moveToUci(s.move) === 'd1d5').score;
  const bestOther = Math.max(...careful.filter((s) => moveToUci(s.move) !== 'd1d5').map((s) => s.score));
  assert.ok(take < bestOther, `${take} < ${bestOther}`);

  const careless = scoreMoves(pos, 1, { quiescence: false });
  const top = careless.reduce((a, b) => (b.score > a.score ? b : a));
  assert.equal(moveToUci(top.move), 'd1d5');
});

test('de engine speelt alleen legale zetten', () => {
  const pos = fromFen(START_FEN);
  const random = createRandom(7);
  for (let i = 0; i < 30 && gameStatus(pos).result === 'ongoing'; i++) {
    const legal = generateLegalMoves(pos);
    const { move } = search(pos, { timeMs: 30, random });
    assert.ok(legal.includes(move), `zet ${i + 1}: ${moveToUci(move)}`);
    makeMove(pos, move);
  }
});

test('zonder legale zetten is er geen zet', () => {
  const result = search(fromFen('k7/8/1Q6/8/8/8/8/K7 b - - 0 1'), { maxDepth: 3 });
  assert.equal(result.move, null);
  assert.equal(result.score, 0);
});

test('scoreMoves met een marge: dichtbij exact, ver eronder alleen een ondergrens', () => {
  const pos = fromFen(PERFT_FENS.kiwipete);
  const exact = new Map(scoreMoves(pos, 2).map((s) => [s.move, s.score]));
  const bestExact = Math.max(...exact.values());
  const withMargin = scoreMoves(pos, 2, { margin: 100 });
  assert.equal(withMargin.length, exact.size);
  assert.equal(Math.max(...withMargin.map((s) => s.score)), bestExact);
  let bounded = 0;
  for (const { move, score } of withMargin) {
    if (exact.get(move) >= bestExact - 100) assert.equal(score, exact.get(move), moveToUci(move));
    else assert.ok(score >= exact.get(move), moveToUci(move));
    if (score > exact.get(move)) bounded += 1;
  }
  assert.ok(bounded > 0, 'met een marge worden slechte zetten niet exact uitgerekend');
});
