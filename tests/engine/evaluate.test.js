import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../../src/fen.js';
import { fromFen } from '../../src/chess/position.js';
import { evaluate, evaluateMaterial, PIECE_VALUES } from '../../src/engine/evaluate.js';
import { PERFT_FENS } from '../chess/fixtures.js';

const score = (fen) => evaluate(fromFen(fen));

/** Spiegelt een stelling: rijen omgekeerd, kleuren gewisseld, de andere speler aan zet. */
function mirrorFen(fen) {
  const [board, turn] = fen.split(' ');
  const swapCase = (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
  const mirrored = board.split('/').reverse().map((row) => [...row].map(swapCase).join('')).join('/');
  return `${mirrored} ${turn === 'w' ? 'b' : 'w'} - - 0 1`;
}

test('de stukwaarden zijn per stuktype vastgelegd', () => {
  assert.deepEqual(PIECE_VALUES, [0, 100, 320, 330, 500, 900, 0]);
});

test('evaluateMaterial telt alleen materiaal, vanuit de speler aan zet', () => {
  assert.equal(evaluateMaterial(fromFen(START_FEN)), 0);
  assert.equal(evaluateMaterial(fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')), 900);
  assert.equal(evaluateMaterial(fromFen('4k3/8/8/8/8/8/8/3QK3 b - - 0 1')), -900);
  assert.equal(evaluateMaterial(fromFen('4k3/pppp4/8/8/8/8/8/R2NK3 w - - 0 1')), 500 + 320 - 4 * 100);
});

test('in de beginstelling staat het gelijk', () => {
  assert.equal(score(START_FEN), 0);
});

test('een gespiegelde stelling krijgt dezelfde score', () => {
  for (const [name, fen] of Object.entries(PERFT_FENS)) {
    assert.equal(score(fen), score(mirrorFen(fen)), name);
  }
});

test('een paard in het centrum is beter dan in de hoek', () => {
  assert.ok(score('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1') > score('4k3/8/8/8/8/8/8/N3K3 w - - 0 1'));
});

test('een pion die ver is opgerukt, is meer waard', () => {
  assert.ok(score('4k3/8/P7/8/8/8/8/4K3 w - - 0 1') > score('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'));
});

test('in het eindspel hoort de koning in het centrum', () => {
  assert.ok(score('7k/8/8/8/3K4/8/8/8 w - - 0 1') > score('7k/8/8/8/8/8/8/K7 w - - 0 1'));
});

test('in het middenspel staat een gerokeerde koning beter dan een koning die naar voren liep', () => {
  assert.ok(
    score('rnbqkbnr/pppppppp/8/8/4P3/4BN2/PPPP1PPP/RNBQ1RK1 w kq - 0 1') >
      score('rnbqkbnr/pppppppp/8/8/4P3/4BN2/PPPPKPPP/RNBQ3R w kq - 0 1'),
  );
});

test('materiaal weegt zwaarder dan de positie', () => {
  const queenUp = score('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
  assert.ok(queenUp > 800 && queenUp < 1000, String(queenUp));
});
