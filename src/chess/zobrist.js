// Zobrist-hashing: elke stelling krijgt een (bijna) unieke 64-bits sleutel,
// opgeslagen als twee 32-bits helften (lo en hi). Wordt gebruikt om herhaling
// te herkennen en later voor de transpositietabel van de engine.
import { WHITE, BLACK, PAWN } from './constants.js';

// Vaste seed, zodat de sleutels bij elke start hetzelfde zijn.
let state = 0x9e3779b9;
function nextRandom() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state | 0;
}

function keyTable(size) {
  const lo = new Int32Array(size);
  const hi = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    lo[i] = nextRandom();
    hi[i] = nextRandom();
  }
  return { lo, hi };
}

/** Index: stuk * 128 + veld. */
export const PIECE_KEYS = keyTable(16 * 128);
/** Index: rokademasker (0-15). */
export const CASTLING_KEYS = keyTable(16);
/** Index: lijn (0-7) van het en-passantveld. */
export const EP_KEYS = keyTable(8);
export const SIDE_KEY = keyTable(1);

/**
 * Telt het en-passantveld mee? Alleen als een pion van de speler aan zet
 * naast de pion staat die net twee stappen zette.
 */
export function isEpRelevant(board, epSquare, turn) {
  if (epSquare < 0) return false;
  const pawnSquare = epSquare + (turn === WHITE ? -16 : 16);
  const ownPawn = turn | PAWN;
  for (const side of [pawnSquare - 1, pawnSquare + 1]) {
    if (!(side & 0x88) && board[side] === ownPawn) return true;
  }
  return false;
}

/** Rekent de hash volledig opnieuw uit. */
export function computeHash(pos) {
  let lo = 0;
  let hi = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const piece = pos.board[sq];
    if (piece) {
      lo ^= PIECE_KEYS.lo[piece * 128 + sq];
      hi ^= PIECE_KEYS.hi[piece * 128 + sq];
    }
  }
  if (pos.turn === BLACK) {
    lo ^= SIDE_KEY.lo[0];
    hi ^= SIDE_KEY.hi[0];
  }
  lo ^= CASTLING_KEYS.lo[pos.castling];
  hi ^= CASTLING_KEYS.hi[pos.castling];
  if (isEpRelevant(pos.board, pos.epSquare, pos.turn)) {
    lo ^= EP_KEYS.lo[pos.epSquare & 7];
    hi ^= EP_KEYS.hi[pos.epSquare & 7];
  }
  return [lo, hi];
}
