// De schaakstelling: bord, wie aan zet is, rokaderechten, en passant en klokken.
import { boardFromFen } from '../fen.js';
import {
  WHITE, BLACK, PAWN, KING, ROOK, pieceColor, pieceType,
  CASTLE_WK, CASTLE_WQ, CASTLE_BK, CASTLE_BQ,
  FLAG_DOUBLE_PUSH, FLAG_EN_PASSANT, FLAG_CASTLE,
  squareFromName, squareName, pieceFromLetter, letterFromPiece,
  moveFrom, moveTo, moveFlags, movePromotion,
} from './constants.js';
import {
  computeHash, isEpRelevant, PIECE_KEYS, CASTLING_KEYS, EP_KEYS, SIDE_KEY,
} from './zobrist.js';

export class Position {
  constructor() {
    this.board = new Int8Array(128);
    this.turn = WHITE;
    this.castling = 0;
    this.epSquare = -1;
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.kings = new Int16Array(2); // index: kleur >> 3
    this.hashLo = 0;
    this.hashHi = 0;
    this.history = [];
  }
}

const CASTLING_LETTERS = [
  ['K', CASTLE_WK],
  ['Q', CASTLE_WQ],
  ['k', CASTLE_BK],
  ['q', CASTLE_BQ],
];

// Een rokaderecht telt alleen als koning en toren nog op hun beginveld staan.
const CASTLING_PIECES = [
  [CASTLE_WK, 'e1', 'h1', WHITE],
  [CASTLE_WQ, 'e1', 'a1', WHITE],
  [CASTLE_BK, 'e8', 'h8', BLACK],
  [CASTLE_BQ, 'e8', 'a8', BLACK],
];

const isWholeNumber = (text) => /^\d+$/.test(text ?? '');

export function fromFen(fen) {
  const parts = String(fen ?? '').trim().split(/\s+/);
  const pos = new Position();

  for (const [name, letter] of Object.entries(boardFromFen(parts[0]))) {
    pos.board[squareFromName(name)] = pieceFromLetter(letter);
  }

  const kingCount = [0, 0];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88 || pieceType(pos.board[sq]) !== KING) continue;
    const index = pieceColor(pos.board[sq]) >> 3;
    kingCount[index] += 1;
    pos.kings[index] = sq;
  }
  if (kingCount[0] !== 1 || kingCount[1] !== 1) {
    throw new Error('Ongeldige FEN: elke kleur moet precies één koning hebben');
  }

  const [, side, castling, ep, halfmove = '0', fullmove = '1'] = parts;
  if (side !== 'w' && side !== 'b') {
    throw new Error(`Ongeldige FEN: onbekend wie aan zet is ('${side ?? ''}')`);
  }
  pos.turn = side === 'w' ? WHITE : BLACK;

  if (castling !== '-' && !/^K?Q?k?q?$/.test(castling ?? '-x')) {
    throw new Error(`Ongeldige FEN: onbekende rokaderechten ('${castling ?? ''}')`);
  }
  for (const [letter, flag] of CASTLING_LETTERS) {
    if (castling.includes(letter)) pos.castling |= flag;
  }
  for (const [flag, kingSquare, rookSquare, color] of CASTLING_PIECES) {
    const kingOk = pos.board[squareFromName(kingSquare)] === (color | KING);
    const rookOk = pos.board[squareFromName(rookSquare)] === (color | ROOK);
    if (!kingOk || !rookOk) pos.castling &= ~flag;
  }

  if (ep !== '-') {
    const expectedRank = pos.turn === WHITE ? '6' : '3';
    if (!/^[a-h][36]$/.test(ep ?? '') || ep[1] !== expectedRank) {
      throw new Error(`Ongeldige FEN: onmogelijk en-passantveld ('${ep ?? ''}')`);
    }
    pos.epSquare = squareFromName(ep);
  }

  if (!isWholeNumber(halfmove) || !isWholeNumber(fullmove) || Number(fullmove) < 1) {
    throw new Error('Ongeldige FEN: de zettellers moeten gehele getallen zijn');
  }
  pos.halfmoveClock = Number(halfmove);
  pos.fullmoveNumber = Number(fullmove);

  [pos.hashLo, pos.hashHi] = computeHash(pos);
  return pos;
}

export function toFen(pos) {
  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = pos.board[rank * 16 + file];
      if (piece) {
        if (empty) row += empty;
        empty = 0;
        row += letterFromPiece(piece);
      } else {
        empty += 1;
      }
    }
    rows.push(empty ? row + empty : row);
  }

  const castling = CASTLING_LETTERS
    .filter(([, flag]) => pos.castling & flag)
    .map(([letter]) => letter)
    .join('') || '-';
  const ep = pos.epSquare < 0 ? '-' : squareName(pos.epSquare);
  const side = pos.turn === WHITE ? 'w' : 'b';
  return `${rows.join('/')} ${side} ${castling} ${ep} ${pos.halfmoveClock} ${pos.fullmoveNumber}`;
}

/** Zelfde vorm als boardFromFen: veldnaam -> FEN-letter. */
export function boardFromPosition(pos) {
  const pieces = {};
  for (let sq = 0; sq < 128; sq++) {
    if (!(sq & 0x88) && pos.board[sq]) pieces[squareName(sq)] = letterFromPiece(pos.board[sq]);
  }
  return pieces;
}

// Per veld: welke rokaderechten blijven over als er een zet van of naar dit veld gaat.
const CASTLING_MASK = new Int8Array(128).fill(15);
CASTLING_MASK[squareFromName('e1')] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLING_MASK[squareFromName('h1')] = 15 & ~CASTLE_WK;
CASTLING_MASK[squareFromName('a1')] = 15 & ~CASTLE_WQ;
CASTLING_MASK[squareFromName('e8')] = 15 & ~(CASTLE_BK | CASTLE_BQ);
CASTLING_MASK[squareFromName('h8')] = 15 & ~CASTLE_BK;
CASTLING_MASK[squareFromName('a8')] = 15 & ~CASTLE_BQ;

/** Bij een rokade: [torenVan, torenNaar], afgeleid van koningVan en koningNaar. */
function castlingRookSquares(from, to) {
  return to > from ? [from + 3, from + 1] : [from - 4, from - 1];
}

/**
 * Voert een zet uit, zonder te controleren of hij legaal is.
 * De hash wordt stapsgewijs bijgewerkt.
 */
export function makeMove(pos, move) {
  const board = pos.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const promotion = movePromotion(move);
  const us = pos.turn;
  const piece = board[from];

  let capturedSquare = to;
  if (flags & FLAG_EN_PASSANT) capturedSquare = to + (us === WHITE ? -16 : 16);
  const captured = board[capturedSquare];

  pos.history.push({
    move,
    captured,
    castling: pos.castling,
    epSquare: pos.epSquare,
    halfmoveClock: pos.halfmoveClock,
    hashLo: pos.hashLo,
    hashHi: pos.hashHi,
  });

  let lo = pos.hashLo;
  let hi = pos.hashHi;

  // Oud en-passantveld en oude rokaderechten uit de hash halen.
  if (isEpRelevant(board, pos.epSquare, us)) {
    lo ^= EP_KEYS.lo[pos.epSquare & 7];
    hi ^= EP_KEYS.hi[pos.epSquare & 7];
  }
  lo ^= CASTLING_KEYS.lo[pos.castling];
  hi ^= CASTLING_KEYS.hi[pos.castling];

  // Geslagen stuk weghalen.
  if (captured) {
    lo ^= PIECE_KEYS.lo[captured * 128 + capturedSquare];
    hi ^= PIECE_KEYS.hi[captured * 128 + capturedSquare];
    board[capturedSquare] = 0;
  }

  // Stuk verplaatsen (bij promotie wordt het een ander stuk).
  const placed = promotion ? us | promotion : piece;
  lo ^= PIECE_KEYS.lo[piece * 128 + from] ^ PIECE_KEYS.lo[placed * 128 + to];
  hi ^= PIECE_KEYS.hi[piece * 128 + from] ^ PIECE_KEYS.hi[placed * 128 + to];
  board[from] = 0;
  board[to] = placed;

  if (flags & FLAG_CASTLE) {
    const [rookFrom, rookTo] = castlingRookSquares(from, to);
    const rook = board[rookFrom];
    lo ^= PIECE_KEYS.lo[rook * 128 + rookFrom] ^ PIECE_KEYS.lo[rook * 128 + rookTo];
    hi ^= PIECE_KEYS.hi[rook * 128 + rookFrom] ^ PIECE_KEYS.hi[rook * 128 + rookTo];
    board[rookFrom] = 0;
    board[rookTo] = rook;
  }

  if (pieceType(piece) === KING) pos.kings[us >> 3] = to;

  pos.castling &= CASTLING_MASK[from] & CASTLING_MASK[to];
  lo ^= CASTLING_KEYS.lo[pos.castling];
  hi ^= CASTLING_KEYS.hi[pos.castling];

  pos.epSquare = flags & FLAG_DOUBLE_PUSH ? (from + to) >> 1 : -1;
  pos.halfmoveClock = pieceType(piece) === PAWN || captured ? 0 : pos.halfmoveClock + 1;
  if (us === BLACK) pos.fullmoveNumber += 1;

  pos.turn = us ^ 8;
  lo ^= SIDE_KEY.lo[0];
  hi ^= SIDE_KEY.hi[0];

  // Nieuw en-passantveld (alleen als de tegenstander echt kan slaan).
  if (isEpRelevant(board, pos.epSquare, pos.turn)) {
    lo ^= EP_KEYS.lo[pos.epSquare & 7];
    hi ^= EP_KEYS.hi[pos.epSquare & 7];
  }

  pos.hashLo = lo;
  pos.hashHi = hi;
}

/** Draait de laatste makeMove exact terug. */
export function unmakeMove(pos) {
  const record = pos.history.pop();
  const { move, captured } = record;
  const board = pos.board;
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const us = pos.turn ^ 8;

  const moved = movePromotion(move) ? us | PAWN : board[to];
  board[from] = moved;
  board[to] = 0;

  if (flags & FLAG_EN_PASSANT) {
    board[to + (us === WHITE ? -16 : 16)] = captured;
  } else if (captured) {
    board[to] = captured;
  }

  if (flags & FLAG_CASTLE) {
    const [rookFrom, rookTo] = castlingRookSquares(from, to);
    board[rookFrom] = board[rookTo];
    board[rookTo] = 0;
  }

  if (pieceType(moved) === KING) pos.kings[us >> 3] = from;

  pos.turn = us;
  if (us === BLACK) pos.fullmoveNumber -= 1;
  pos.castling = record.castling;
  pos.epSquare = record.epSquare;
  pos.halfmoveClock = record.halfmoveClock;
  pos.hashLo = record.hashLo;
  pos.hashHi = record.hashHi;
}
