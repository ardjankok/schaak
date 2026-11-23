// Wedstrijd: de engine tegen een speler die willekeurige legale zetten doet.
// Start met: npm run match
import { START_FEN } from '../src/fen.js';
import { fromFen, makeMove } from '../src/chess/position.js';
import { generateLegalMoves } from '../src/chess/movegen.js';
import { gameStatus } from '../src/chess/status.js';
import { search } from '../src/engine/search-v1.js';
import { createRandom } from '../src/engine/random.js';

const GAMES = 20;
const DEPTH = 3;
const MAX_PLIES = 400;
const MIN_SCORE = 18;
const MAX_MOVE_MS = 2000;

const engineTimes = [];

const enginePlayer = (pos, random) => {
  const start = performance.now();
  const { move } = search(pos, { depth: DEPTH, random });
  engineTimes.push(performance.now() - start);
  return move;
};

const randomPlayer = (pos, random) => {
  const moves = generateLegalMoves(pos);
  return moves[Math.floor(random() * moves.length)];
};

/** Speelt één partij. Geeft 1 (engine wint), 0.5 of 0 terug, plus de reden. */
function playGame(engineIsWhite, random) {
  const pos = fromFen(START_FEN);
  for (let ply = 0; ply < MAX_PLIES; ply++) {
    const status = gameStatus(pos);
    if (status.result !== 'ongoing') {
      if (status.result !== 'checkmate') return { points: 0.5, reason: status.result, ply };
      const engineWon = (status.winner === 'white') === engineIsWhite;
      return { points: engineWon ? 1 : 0, reason: 'mat', ply };
    }
    const engineToMove = (pos.turn === 0) === engineIsWhite;
    makeMove(pos, (engineToMove ? enginePlayer : randomPlayer)(pos, random));
  }
  return { points: 0.5, reason: `${MAX_PLIES} halve zetten`, ply: MAX_PLIES };
}

let score = 0;
const tally = { win: 0, draw: 0, loss: 0 };
for (let i = 0; i < GAMES; i++) {
  const engineIsWhite = i % 2 === 0;
  const { points, reason, ply } = playGame(engineIsWhite, createRandom(1000 + i));
  score += points;
  tally[points === 1 ? 'win' : points === 0 ? 'loss' : 'draw'] += 1;
  const label = points === 1 ? 'winst  ' : points === 0 ? 'verlies' : 'remise ';
  console.log(`partij ${String(i + 1).padStart(2)} (engine ${engineIsWhite ? 'wit  ' : 'zwart'}): ${label} ${reason}, ${ply} halve zetten`);
}

const average = engineTimes.reduce((a, b) => a + b, 0) / engineTimes.length;
const longest = Math.max(...engineTimes);
console.log(`\nwinst ${tally.win}, remise ${tally.draw}, verlies ${tally.loss}: score ${score}/${GAMES}`);
console.log(`denktijd engine (diepte ${DEPTH}): gemiddeld ${average.toFixed(1)} ms, langste ${longest.toFixed(0)} ms, ${engineTimes.length} zetten`);

const ok = score >= MIN_SCORE && tally.loss === 0 && longest < MAX_MOVE_MS;
console.log(ok ? 'OK' : `FOUT: nodig is score >= ${MIN_SCORE}, 0 verloren en langste zet < ${MAX_MOVE_MS} ms`);
process.exitCode = ok ? 0 : 1;
