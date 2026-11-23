// Zoekt de beste zet met negamax en alfa-bètasnoeiing, op een vaste diepte.
import { makeMove, unmakeMove } from '../chess/position.js';
import { generateLegalMoves, isInCheck } from '../chess/movegen.js';
import { countRepetitions, isInsufficientMaterial } from '../chess/status.js';
import { evaluate } from './evaluate.js';

/** Score voor mat. Een mat na n halve zetten scoort MATE - n, zodat sneller mat beter is. */
export const MATE = 100000;

/**
 * Remise volgens de zoekboom: 50 zetten, te weinig materiaal, of een
 * stelling die al eerder voorkwam. Eén herhaling telt al, anders loopt een
 * engine die voor staat zo een herhaling in.
 */
export function isDraw(pos) {
  return pos.halfmoveClock >= 100 || isInsufficientMaterial(pos) || countRepetitions(pos) >= 2;
}

/**
 * @param {import('../chess/position.js').Position} pos wordt tijdelijk gewijzigd, en daarna teruggezet
 * @param {{ depth: number, random?: () => number }} options
 * @returns {{ move: number | null, score: number, nodes: number }}
 */
export function search(pos, { depth, random = Math.random }) {
  const counter = { nodes: 1 };
  const moves = shuffle(generateLegalMoves(pos), random);
  if (moves.length === 0) {
    return { move: null, score: isInCheck(pos) ? -MATE : 0, nodes: counter.nodes };
  }

  let bestMove = moves[0];
  let alpha = -Infinity;
  for (const move of moves) {
    makeMove(pos, move);
    const score = -negamax(pos, depth - 1, -Infinity, -alpha, 1, counter);
    unmakeMove(pos);
    if (score > alpha) {
      alpha = score;
      bestMove = move;
    }
  }
  return { move: bestMove, score: alpha, nodes: counter.nodes };
}

function negamax(pos, depth, alpha, beta, ply, counter) {
  counter.nodes += 1;
  if (isDraw(pos)) return 0;
  if (depth <= 0) return evaluate(pos);

  const moves = generateLegalMoves(pos);
  if (moves.length === 0) return isInCheck(pos) ? -(MATE - ply) : 0;

  for (const move of moves) {
    makeMove(pos, move);
    const score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, counter);
    unmakeMove(pos);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

/** Fisher-Yates: schudt de lijst op zijn plaats en geeft hem terug. */
function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
