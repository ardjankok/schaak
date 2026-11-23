// Engine versie 1 (stap 4): negamax met alfa-bèta op een vaste diepte, alleen
// materiaal. Blijft bewaard om nieuwe versies tegen te laten spelen.
import { makeMove, unmakeMove } from '../chess/position.js';
import { generateLegalMoves, isInCheck } from '../chess/movegen.js';
import { evaluateMaterial as evaluate } from './evaluate.js';
import { MATE, isDraw, shuffle } from './common.js';

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
