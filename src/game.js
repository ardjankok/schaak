// Een partij voor twee spelers op één scherm. Vertaalt tikken op velden naar
// zetten en houdt bij wat geselecteerd is. Zonder DOM, zodat alles te testen is.
import { START_FEN } from './fen.js';
import { WHITE, squareName, moveFrom, moveTo, movePromotion } from './chess/constants.js';
import { fromFen, makeMove, boardFromPosition } from './chess/position.js';
import { generateLegalMoves, isInCheck } from './chess/movegen.js';
import { gameStatus } from './chess/status.js';
import { moveFromUci } from './chess/notation.js';

const PROMOTION_CHOICES = ['q', 'r', 'b', 'n'];
const COLOR_NAMES = { white: 'Wit', black: 'Zwart' };

const DRAW_TEXTS = {
  stalemate: 'Pat: remise',
  'draw-fifty': 'Remise: 50 zetten zonder slag of pionzet',
  'draw-repetition': 'Remise: drie keer dezelfde stelling',
  'draw-material': 'Remise: te weinig materiaal om mat te zetten',
};

/** De statusregel onder het bord. */
export function describeStatus(status, turn, inCheck) {
  if (status.result === 'checkmate') return `Schaakmat! ${COLOR_NAMES[status.winner]} wint`;
  if (DRAW_TEXTS[status.result]) return DRAW_TEXTS[status.result];
  const toMove = `${COLOR_NAMES[turn]} is aan zet`;
  return inCheck ? `Schaak! ${toMove}` : toMove;
}

export class Game {
  constructor(fen = START_FEN) {
    this.reset(fen);
  }

  reset(fen = START_FEN) {
    this._pos = fromFen(fen);
    this._selected = null;
    this._lastMove = null;
    this._pendingPromotion = null;
    this._update();
  }

  get turn() {
    return this._pos.turn === WHITE ? 'white' : 'black';
  }

  get selected() {
    return this._selected;
  }

  get lastMove() {
    return this._lastMove;
  }

  get pendingPromotion() {
    return this._pendingPromotion;
  }

  get status() {
    return this._status;
  }

  get checkSquare() {
    return this._checkSquare;
  }

  get isOver() {
    return this._status.result !== 'ongoing';
  }

  pieces() {
    return boardFromPosition(this._pos);
  }

  targets() {
    if (!this._selected) return [];
    const squares = new Set();
    for (const move of this._legalMoves) {
      if (squareName(moveFrom(move)) === this._selected) squares.add(squareName(moveTo(move)));
    }
    return [...squares].sort();
  }

  tap(square) {
    if (this.isOver || this._pendingPromotion) return 'ignored';

    if (this._selected && this.targets().includes(square)) {
      const from = this._selected;
      if (this._isPromotion(from, square)) {
        this._pendingPromotion = { from, to: square };
        return 'promotion';
      }
      this._play(from, square, '');
      return 'moved';
    }

    if (square === this._selected) {
      this._selected = null;
      return 'deselected';
    }

    if (this._isOwnPiece(square)) {
      this._selected = square;
      return 'selected';
    }

    if (this._selected) {
      this._selected = null;
      return 'deselected';
    }
    return 'ignored';
  }

  choosePromotion(letter) {
    if (!this._pendingPromotion || !PROMOTION_CHOICES.includes(letter)) return false;
    const { from, to } = this._pendingPromotion;
    this._pendingPromotion = null;
    this._play(from, to, letter);
    return true;
  }

  cancelPromotion() {
    this._pendingPromotion = null;
    this._selected = null;
  }

  statusText() {
    return describeStatus(this._status, this.turn, this._checkSquare !== null);
  }

  _play(from, to, promotion) {
    makeMove(this._pos, moveFromUci(this._pos, from + to + promotion));
    this._selected = null;
    this._lastMove = { from, to };
    this._update();
  }

  _isPromotion(from, to) {
    return this._legalMoves.some(
      (move) => squareName(moveFrom(move)) === from && squareName(moveTo(move)) === to && movePromotion(move),
    );
  }

  _isOwnPiece(square) {
    const letter = this.pieces()[square];
    if (!letter) return false;
    const isWhite = letter === letter.toUpperCase();
    return isWhite === (this._pos.turn === WHITE);
  }

  /** Rekent na elke zet de legale zetten, de status en het schaakveld opnieuw uit. */
  _update() {
    this._legalMoves = generateLegalMoves(this._pos);
    this._status = gameStatus(this._pos);
    this._checkSquare = isInCheck(this._pos) ? squareName(this._pos.kings[this._pos.turn >> 3]) : null;
  }
}
