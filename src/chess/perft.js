// Perft telt alle stellingen tot een bepaalde diepte. Het resultaat vergelijken
// met bekende getallen bewijst dat de zetgenerator alle regels goed toepast.
import { makeMove, unmakeMove } from './position.js';
import { generateMoves, isInCheck } from './movegen.js';

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const us = pos.turn;
  let nodes = 0;
  for (const move of generateMoves(pos)) {
    makeMove(pos, move);
    if (!isInCheck(pos, us)) nodes += depth === 1 ? 1 : perft(pos, depth - 1);
    unmakeMove(pos);
  }
  return nodes;
}
