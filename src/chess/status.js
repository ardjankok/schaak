// Is de partij voorbij? Mat, pat, of remise (materiaal, 50 zetten, herhaling).
import { WHITE, KNIGHT, BISHOP, KING, pieceType } from './constants.js';
import { generateLegalMoves, isInCheck } from './movegen.js';

/**
 * @returns {{ result: 'ongoing' | 'checkmate' | 'stalemate' | 'draw-fifty' | 'draw-repetition' | 'draw-material',
 *             winner: 'white' | 'black' | null }}
 */
export function gameStatus(pos) {
  if (generateLegalMoves(pos).length === 0) {
    if (isInCheck(pos)) {
      return { result: 'checkmate', winner: pos.turn === WHITE ? 'black' : 'white' };
    }
    return { result: 'stalemate', winner: null };
  }
  if (isInsufficientMaterial(pos)) return { result: 'draw-material', winner: null };
  if (pos.halfmoveClock >= 100) return { result: 'draw-fifty', winner: null };
  if (isThreefoldRepetition(pos)) return { result: 'draw-repetition', winner: null };
  return { result: 'ongoing', winner: null };
}

/**
 * Niemand kan nog mat zetten: K-K, K+L-K, K+P-K, of alleen lopers die
 * allemaal op dezelfde kleur velden staan.
 */
export function isInsufficientMaterial(pos) {
  let knights = 0;
  const bishopSquareColors = new Set();
  let bishops = 0;

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const type = pieceType(pos.board[sq]);
    if (!type || type === KING) continue;
    if (type === KNIGHT) {
      knights += 1;
    } else if (type === BISHOP) {
      bishops += 1;
      bishopSquareColors.add(((sq & 7) + (sq >> 4)) % 2);
    } else {
      return false; // pion, toren of dame
    }
  }

  if (knights + bishops <= 1) return true;
  return knights === 0 && bishopSquareColors.size === 1;
}

/**
 * Komt de huidige stelling voor de 3e keer voor? Alleen stellingen sinds de
 * laatste slag of pionzet tellen, en alleen met dezelfde speler aan zet.
 */
export function isThreefoldRepetition(pos) {
  const history = pos.history;
  const reach = Math.min(pos.halfmoveClock, history.length);
  let count = 1;
  for (let back = 2; back <= reach; back += 2) {
    const earlier = history[history.length - back];
    if (earlier.hashLo === pos.hashLo && earlier.hashHi === pos.hashHi) {
      count += 1;
      if (count >= 3) return true;
    }
  }
  return false;
}
