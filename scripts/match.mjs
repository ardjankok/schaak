// Wedstrijd tussen twee spelers. Start met:
//   npm run match -- <speler A> <speler B> [partijen = 20] [tijdschaal = 1] [--min <score>]
// Spelers: random, v1 (engine van stap 4, diepte 3), v2:<ms> (engine v2 met die denktijd), level:<n>.
import { START_FEN } from '../src/fen.js';
import { WHITE } from '../src/chess/constants.js';
import { fromFen, makeMove } from '../src/chess/position.js';
import { generateLegalMoves } from '../src/chess/movegen.js';
import { gameStatus } from '../src/chess/status.js';
import { search as searchV1 } from '../src/engine/search-v1.js';
import { search } from '../src/engine/search.js';
import { chooseMove } from '../src/engine/levels.js';
import { createRandom } from '../src/engine/random.js';

const MAX_PLIES = 300;
const OPENING_PLIES = 4;

const args = process.argv.slice(2);
const minIndex = args.indexOf('--min');
const minScore = minIndex >= 0 ? Number(args.splice(minIndex, 2)[1]) : null;
const [nameA, nameB, gamesArg = '20', scaleArg = '1'] = args;
const games = Number(gamesArg);
const timeScale = Number(scaleArg);
if (!nameA || !nameB) {
  console.error('Gebruik: npm run match -- <speler A> <speler B> [partijen] [tijdschaal] [--min <score>]');
  process.exit(2);
}

const randomMove = (pos, random) => {
  const moves = generateLegalMoves(pos);
  return moves[Math.floor(random() * moves.length)];
};

/** Maakt een speler: (pos, random) => zet, met tijden (en diepten voor v2). */
function makePlayer(name) {
  const stats = { name, times: [], depths: [] };
  let think;
  if (name === 'random') think = randomMove;
  else if (name === 'v1') think = (pos, random) => searchV1(pos, { depth: 3, random }).move;
  else if (name.startsWith('v2:')) {
    const timeMs = Number(name.slice(3)) * timeScale;
    think = (pos, random) => {
      const result = search(pos, { timeMs, random });
      stats.depths.push(result.depth);
      return result.move;
    };
  } else if (name.startsWith('level:')) {
    const level = Number(name.slice(6));
    think = (pos, random) => chooseMove(pos, level, { random, timeScale }).move;
  } else throw new Error(`Onbekende speler: ${name}`);

  stats.move = (pos, random) => {
    const start = performance.now();
    const move = think(pos, random);
    stats.times.push(performance.now() - start);
    return move;
  };
  return stats;
}

const playerA = makePlayer(nameA);
const playerB = makePlayer(nameB);

/** Eén partij; geeft de punten voor A (1, ½ of 0) en de reden. */
function playGame(index) {
  const pos = fromFen(START_FEN);
  const opening = createRandom(500 + Math.floor(index / 2)); // partij 2k en 2k+1: zelfde opening
  for (let i = 0; i < OPENING_PLIES && gameStatus(pos).result === 'ongoing'; i++) makeMove(pos, randomMove(pos, opening));

  const aIsWhite = index % 2 === 0;
  const randomA = createRandom(1000 + index);
  const randomB = createRandom(2000 + index);
  for (let ply = OPENING_PLIES; ; ply++) {
    const status = gameStatus(pos);
    if (status.result !== 'ongoing') {
      if (status.result !== 'checkmate') return { points: 0.5, reason: status.result, ply };
      return { points: (status.winner === 'white') === aIsWhite ? 1 : 0, reason: 'mat', ply };
    }
    if (ply >= MAX_PLIES) return { points: 0.5, reason: `${MAX_PLIES} halve zetten`, ply };
    const aToMove = (pos.turn === WHITE) === aIsWhite;
    makeMove(pos, aToMove ? playerA.move(pos, randomA) : playerB.move(pos, randomB));
  }
}

let score = 0;
const tally = { win: 0, draw: 0, loss: 0 };
for (let i = 0; i < games; i++) {
  const { points, reason, ply } = playGame(i);
  score += points;
  tally[points === 1 ? 'win' : points === 0 ? 'loss' : 'draw'] += 1;
  const label = points === 1 ? 'winst  ' : points === 0 ? 'verlies' : 'remise ';
  console.log(`partij ${String(i + 1).padStart(2)} (${nameA} ${i % 2 === 0 ? 'wit  ' : 'zwart'}): ${label} ${reason}, ${ply} halve zetten`);
}

const summary = (p) => {
  const avg = p.times.reduce((a, b) => a + b, 0) / Math.max(1, p.times.length);
  const depth = p.depths.length ? `, gemiddelde diepte ${(p.depths.reduce((a, b) => a + b, 0) / p.depths.length).toFixed(1)}` : '';
  return `${p.name}: gemiddeld ${avg.toFixed(1)} ms, langste ${Math.max(0, ...p.times).toFixed(0)} ms per zet${depth}`;
};
console.log(`\n${nameA} tegen ${nameB}: winst ${tally.win}, remise ${tally.draw}, verlies ${tally.loss}; score ${nameA} ${score}/${games}`);
console.log(summary(playerA));
console.log(summary(playerB));
if (minScore !== null) {
  const ok = score >= minScore;
  console.log(ok ? `OK (minimaal ${minScore})` : `FOUT: score ${score} is lager dan ${minScore}`);
  process.exitCode = ok ? 0 : 1;
}
