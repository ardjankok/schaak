// Basisbouwstenen: kleuren, stukken, velden (0x88) en zetten als getal.

export const WHITE = 0;
export const BLACK = 8;

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

/** Een stuk is kleur | type, bijvoorbeeld BLACK | QUEEN = 13. */
export const pieceColor = (piece) => piece & 8;
export const pieceType = (piece) => piece & 7;

export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

export const FLAG_CAPTURE = 1;
export const FLAG_DOUBLE_PUSH = 2;
export const FLAG_EN_PASSANT = 4;
export const FLAG_CASTLE = 8;

const FILES = 'abcdefgh';
const LETTERS = ' pnbrqk'; // index = stuktype

/** 0x88-index: rij * 16 + lijn (a1 = 0, h8 = 119). Een veld met sq & 0x88 ligt buiten het bord. */
export function squareFromName(name) {
  const file = FILES.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  return rank * 16 + file;
}

export function squareName(sq) {
  return `${FILES[sq & 7]}${(sq >> 4) + 1}`;
}

export function pieceFromLetter(letter) {
  const type = LETTERS.indexOf(letter.toLowerCase());
  const color = letter === letter.toUpperCase() ? WHITE : BLACK;
  return color | type;
}

export function letterFromPiece(piece) {
  const letter = LETTERS[pieceType(piece)];
  return pieceColor(piece) === WHITE ? letter.toUpperCase() : letter;
}

/** Een zet past in één getal: van (7 bits), naar (7 bits), promotie (3 bits), vlaggen (4 bits). */
export function encodeMove(from, to, flags = 0, promotion = 0) {
  return from | (to << 7) | (promotion << 14) | (flags << 17);
}

export const moveFrom = (move) => move & 0x7f;
export const moveTo = (move) => (move >> 7) & 0x7f;
export const movePromotion = (move) => (move >> 14) & 7;
export const moveFlags = (move) => (move >> 17) & 0xf;
