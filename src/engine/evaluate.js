// Beoordeelt een stelling: materiaal plus positietabellen (waar staan de stukken).
import { WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, pieceColor, pieceType } from '../chess/constants.js';

/** Waarde per stuktype in centipionnen: -, pion, paard, loper, toren, dame, koning. */
export const PIECE_VALUES = [0, 100, 320, 330, 500, 900, 0];

/** Hoeveel een stuk meetelt voor de spelfase (24 = volledig middenspel). */
const PHASE_WEIGHTS = [0, 0, 1, 1, 2, 4, 0];
const FULL_PHASE = 24;

/** Afstand tot het centrum: 0 op d4/e4/d5/e5, 3 in de hoeken. */
const centerDistance = (file, rank) => Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5)) - 0.5;
const isCenterFile = (file) => file === 3 || file === 4;

/** Bonus voor een stuk op (lijn, rij), rij gezien vanaf de eigen kant: [middenspel, eindspel]. */
function squareBonus(type, file, rank) {
  const center = 2 - centerDistance(file, rank);
  switch (type) {
    case PAWN:
      return [
        [0, 0, 5, 10, 20, 35, 60, 0][rank] + (isCenterFile(file) && (rank === 3 || rank === 4) ? 10 : 0),
        [0, 0, 10, 20, 35, 60, 100, 0][rank],
      ];
    case KNIGHT:
      return [center * 12, center * 12];
    case BISHOP:
      return [center * 6, center * 6];
    case ROOK:
      return [(rank === 6 ? 20 : 0) + (isCenterFile(file) ? 5 : 0), rank === 6 ? 20 : 0];
    case QUEEN:
      return [center * 4, center * 4];
    case KING:
      return [rank === 0 ? ([0, 1, 2, 6, 7].includes(file) ? 20 : 0) : -20 * rank, center * 15];
    default:
      return [0, 0];
  }
}

// Tabellen per stuktype, index rij * 8 + lijn (vanaf de eigen kant).
const MIDDLEGAME = [];
const ENDGAME = [];
for (let type = 0; type <= KING; type++) {
  MIDDLEGAME[type] = new Int16Array(64);
  ENDGAME[type] = new Int16Array(64);
  for (let index = 0; index < 64; index++) {
    const [mg, eg] = squareBonus(type, index & 7, index >> 3);
    MIDDLEGAME[type][index] = mg;
    ENDGAME[type][index] = eg;
  }
}

/** Alleen materiaal, vanuit de speler aan zet (de evaluatie van versie 1). */
export function evaluateMaterial(pos) {
  let score = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7; // naar het begin van de volgende rij
      continue;
    }
    const piece = pos.board[sq];
    if (!piece) continue;
    const value = PIECE_VALUES[pieceType(piece)];
    score += pieceColor(piece) === WHITE ? value : -value;
  }
  return pos.turn === WHITE ? score : -score;
}

/**
 * Materiaal plus positie, vanuit de speler aan zet. De positiebonus schuift
 * met de spelfase van middenspel naar eindspel.
 */
export function evaluate(pos) {
  let material = 0;
  let middlegame = 0;
  let endgame = 0;
  let phase = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = pos.board[sq];
    if (!piece) continue;
    const type = pieceType(piece);
    const white = pieceColor(piece) === WHITE;
    const rank = white ? sq >> 4 : 7 - (sq >> 4);
    const index = rank * 8 + (sq & 7);
    const sign = white ? 1 : -1;
    material += sign * PIECE_VALUES[type];
    middlegame += sign * MIDDLEGAME[type][index];
    endgame += sign * ENDGAME[type][index];
    phase += PHASE_WEIGHTS[type];
  }
  phase = Math.min(phase, FULL_PHASE);
  // Math.trunc is symmetrisch rond 0, zodat een gespiegelde stelling precies dezelfde score krijgt.
  const score = material + Math.trunc((middlegame * phase + endgame * (FULL_PHASE - phase)) / FULL_PHASE);
  return pos.turn === WHITE ? score : 0 - score; // 0 - 0 geeft 0, niet -0
}
