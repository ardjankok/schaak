// Zetten als tekst in UCI-notatie: 'e2e4', 'e1g1' (rokade), 'e7e8q' (promotie).
import { KNIGHT, BISHOP, ROOK, QUEEN, squareName, moveFrom, moveTo, movePromotion } from './constants.js';
import { generateLegalMoves } from './movegen.js';

const PROMOTION_LETTERS = { [KNIGHT]: 'n', [BISHOP]: 'b', [ROOK]: 'r', [QUEEN]: 'q' };
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

export function moveToUci(move) {
  const promotion = movePromotion(move);
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + (promotion ? PROMOTION_LETTERS[promotion] : '');
}

/** De legale zet die bij de tekst hoort, of null. */
export function moveFromUci(pos, uci) {
  if (typeof uci !== 'string' || !UCI_PATTERN.test(uci)) return null;
  return generateLegalMoves(pos).find((move) => moveToUci(move) === uci) ?? null;
}
