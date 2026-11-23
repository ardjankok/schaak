// Een partij op één scherm: met z'n tweeën, of tegen de computer. Vertaalt
// tikken op velden naar zetten en houdt bij wat geselecteerd is. Zonder DOM,
// zodat alles te testen is.
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

/**
 * De statusregel onder het bord.
 * @param {'white' | 'black' | null} computerColor null bij twee spelers
 */
export function describeStatus(status, turn, inCheck, computerColor = null) {
  if (status.result === 'checkmate') {
    if (!computerColor) return `Schaakmat! ${COLOR_NAMES[status.winner]} wint`;
    return status.winner === computerColor ? 'Schaakmat! De computer wint' : 'Schaakmat! Jij wint';
  }
  if (DRAW_TEXTS[status.result]) return DRAW_TEXTS[status.result];
  let toMove = `${COLOR_NAMES[turn]} is aan zet`;
  if (computerColor) toMove = turn === computerColor ? 'De computer denkt na…' : 'Jij bent aan zet';
  return inCheck ? `Schaak! ${toMove}` : toMove;
}

export class Game {
  /** @param {{ computerColor?: 'white' | 'black' | null }} [options] */
  constructor(fen = START_FEN, { computerColor = null } = {}) {
    this._computerColor = computerColor;
    this.reset(fen);
  }

  reset(fen = START_FEN) {
    this._pos = fromFen(fen);
    this._startFen = fen;
    this._moves = [];
    this._selected = null;
    this._lastMove = null;
    this._pendingPromotion = null;
    this._update();
  }

  get startFen() {
    return this._startFen;
  }

  get computerColor() {
    return this._computerColor;
  }

  get isComputerTurn() {
    return this._computerColor !== null && !this.isOver && this.turn === this._computerColor;
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

  /** De gespeelde zetten in UCI sinds `startFen` (een kopie). */
  moves() {
    return [...this._moves];
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
    if (this.isComputerTurn || this.isOver || this._pendingPromotion) return 'ignored';

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

  /** Speelt een zet in UCI, zoals die van de computer. Geeft false als hij niet legaal is. */
  playUci(uci) {
    if (this.isOver) return false;
    const move = moveFromUci(this._pos, uci);
    if (move === null) return false;
    this._pendingPromotion = null;
    this._apply(move, uci);
    return true;
  }

  statusText() {
    return describeStatus(this._status, this.turn, this._checkSquare !== null, this._computerColor);
  }

  _play(from, to, promotion) {
    const uci = from + to + promotion;
    this._apply(moveFromUci(this._pos, uci), uci);
  }

  _apply(move, uci) {
    makeMove(this._pos, move);
    this._moves.push(uci);
    this._selected = null;
    this._lastMove = Object.freeze({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
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
    this._status = Object.freeze(gameStatus(this._pos));
    this._checkSquare = isInCheck(this._pos) ? squareName(this._pos.kings[this._pos.turn >> 3]) : null;
  }
}
