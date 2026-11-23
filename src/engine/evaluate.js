// Beoordeelt een stelling. Versie 1 telt alleen materiaal.
import { WHITE, pieceColor, pieceType } from '../chess/constants.js';

/** Waarde per stuktype in centipionnen: -, pion, paard, loper, toren, dame, koning. */
export const PIECE_VALUES = [0, 100, 320, 330, 500, 900, 0];

/** Materiaal van de speler aan zet min dat van de tegenstander. */
export function evaluate(pos) {
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
