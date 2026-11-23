// De schaakstelling: bord, wie aan zet is, rokaderechten, en passant en klokken.
import { boardFromFen } from '../fen.js';
import {
  WHITE, BLACK, KING, ROOK, pieceColor, pieceType,
  CASTLE_WK, CASTLE_WQ, CASTLE_BK, CASTLE_BQ,
  squareFromName, squareName, pieceFromLetter, letterFromPiece,
} from './constants.js';
import { computeHash } from './zobrist.js';

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
