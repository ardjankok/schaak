// Zetgenerator: vindt alle zetten in een stelling.
import {
  WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, pieceColor, pieceType,
  CASTLE_WK, CASTLE_WQ, CASTLE_BK, CASTLE_BQ,
  FLAG_CAPTURE, FLAG_DOUBLE_PUSH, FLAG_EN_PASSANT, FLAG_CASTLE,
  encodeMove, squareFromName,
} from './constants.js';
import { makeMove, unmakeMove } from './position.js';

const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP_OFFSETS = [-17, -15, 15, 17];
const ROOK_OFFSETS = [-16, -1, 1, 16];
const KING_OFFSETS = [...BISHOP_OFFSETS, ...ROOK_OFFSETS];
const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT];

const [A1, B1, C1, D1, E1, F1, G1] = ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1'].map(squareFromName);
const [A8, B8, C8, D8, E8, F8, G8] = ['a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8'].map(squareFromName);
void A1; void A8; // alleen ter oriëntatie

/** Wordt veld `sq` aangevallen door een stuk van kleur `byColor`? */
export function isSquareAttacked(pos, sq, byColor) {
  const board = pos.board;

  // Pionnen: een witte pion slaat schuin omhoog, dus hij staat schuin onder het veld.
  const pawn = byColor | PAWN;
  const pawnFrom = byColor === WHITE ? [sq - 15, sq - 17] : [sq + 15, sq + 17];
  for (const t of pawnFrom) {
    if (!(t & 0x88) && board[t] === pawn) return true;
  }

  const knight = byColor | KNIGHT;
  for (const offset of KNIGHT_OFFSETS) {
    const t = sq + offset;
    if (!(t & 0x88) && board[t] === knight) return true;
  }

  const king = byColor | KING;
  for (const offset of KING_OFFSETS) {
    const t = sq + offset;
    if (!(t & 0x88) && board[t] === king) return true;
  }

  const queen = byColor | QUEEN;
  if (slidingAttack(board, sq, BISHOP_OFFSETS, byColor | BISHOP, queen)) return true;
  if (slidingAttack(board, sq, ROOK_OFFSETS, byColor | ROOK, queen)) return true;
  return false;
}

function slidingAttack(board, sq, offsets, slider, queen) {
  for (const offset of offsets) {
    for (let t = sq + offset; !(t & 0x88); t += offset) {
      const piece = board[t];
      if (piece) {
        if (piece === slider || piece === queen) return true;
        break;
      }
    }
  }
  return false;
}

/** Staat de koning van `color` schaak? */
export function isInCheck(pos, color = pos.turn) {
  return isSquareAttacked(pos, pos.kings[color >> 3], color ^ 8);
}

/** Alle pseudo-legale zetten: de eigen koning kan daarna nog schaak staan. */
export function generateMoves(pos) {
  const moves = [];
  const board = pos.board;
  const us = pos.turn;
  const them = us ^ 8;

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7; // naar het begin van de volgende rij
      continue;
    }
    const piece = board[sq];
    if (!piece || pieceColor(piece) !== us) continue;

    switch (pieceType(piece)) {
      case PAWN:
        addPawnMoves(pos, sq, us, them, moves);
        break;
      case KNIGHT:
        addStepMoves(board, sq, KNIGHT_OFFSETS, them, moves);
        break;
      case BISHOP:
        addSlidingMoves(board, sq, BISHOP_OFFSETS, them, moves);
        break;
      case ROOK:
        addSlidingMoves(board, sq, ROOK_OFFSETS, them, moves);
        break;
      case QUEEN:
        addSlidingMoves(board, sq, KING_OFFSETS, them, moves);
        break;
      case KING:
        addStepMoves(board, sq, KING_OFFSETS, them, moves);
        addCastlingMoves(pos, us, them, moves);
        break;
    }
  }
  return moves;
}

function addPawnMoves(pos, sq, us, them, moves) {
  const board = pos.board;
  const forward = us === WHITE ? 16 : -16;
  const startRank = us === WHITE ? 1 : 6;
  const promotionRank = us === WHITE ? 7 : 0;

  const addPawnMove = (to, flags) => {
    if (to >> 4 === promotionRank) {
      for (const promotion of PROMOTIONS) moves.push(encodeMove(sq, to, flags, promotion));
    } else {
      moves.push(encodeMove(sq, to, flags));
    }
  };

  const one = sq + forward;
  if (!(one & 0x88) && !board[one]) {
    addPawnMove(one, 0);
    const two = one + forward;
    if (sq >> 4 === startRank && !board[two]) moves.push(encodeMove(sq, two, FLAG_DOUBLE_PUSH));
  }

  for (const side of [forward - 1, forward + 1]) {
    const to = sq + side;
    if (to & 0x88) continue;
    const target = board[to];
    if (target && pieceColor(target) === them) {
      addPawnMove(to, FLAG_CAPTURE);
    } else if (to === pos.epSquare) {
      moves.push(encodeMove(sq, to, FLAG_EN_PASSANT | FLAG_CAPTURE));
    }
  }
}

function addStepMoves(board, sq, offsets, them, moves) {
  for (const offset of offsets) {
    const to = sq + offset;
    if (to & 0x88) continue;
    const target = board[to];
    if (!target) moves.push(encodeMove(sq, to));
    else if (pieceColor(target) === them) moves.push(encodeMove(sq, to, FLAG_CAPTURE));
  }
}

function addSlidingMoves(board, sq, offsets, them, moves) {
  for (const offset of offsets) {
    for (let to = sq + offset; !(to & 0x88); to += offset) {
      const target = board[to];
      if (!target) {
        moves.push(encodeMove(sq, to));
        continue;
      }
      if (pieceColor(target) === them) moves.push(encodeMove(sq, to, FLAG_CAPTURE));
      break;
    }
  }
}

function addCastlingMoves(pos, us, them, moves) {
  const board = pos.board;
  const safe = (...squares) => squares.every((s) => !isSquareAttacked(pos, s, them));

  if (us === WHITE) {
    if (pos.castling & CASTLE_WK && !board[F1] && !board[G1] && safe(E1, F1, G1)) {
      moves.push(encodeMove(E1, G1, FLAG_CASTLE));
    }
    if (pos.castling & CASTLE_WQ && !board[D1] && !board[C1] && !board[B1] && safe(E1, D1, C1)) {
      moves.push(encodeMove(E1, C1, FLAG_CASTLE));
    }
  } else {
    if (pos.castling & CASTLE_BK && !board[F8] && !board[G8] && safe(E8, F8, G8)) {
      moves.push(encodeMove(E8, G8, FLAG_CASTLE));
    }
    if (pos.castling & CASTLE_BQ && !board[D8] && !board[C8] && !board[B8] && safe(E8, D8, C8)) {
      moves.push(encodeMove(E8, C8, FLAG_CASTLE));
    }
  }
}

/** Alle legale zetten: zetten waarna de eigen koning niet schaak staat. */
export function generateLegalMoves(pos) {
  const us = pos.turn;
  const legal = [];
  for (const move of generateMoves(pos)) {
    makeMove(pos, move);
    if (!isInCheck(pos, us)) legal.push(move);
    unmakeMove(pos);
  }
  return legal;
}
