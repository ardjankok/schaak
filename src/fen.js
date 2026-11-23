// FEN (Forsyth-Edwards Notation) is de standaardmanier om een schaakstelling
// als tekst op te schrijven.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = 'abcdefgh';
const PIECES = 'KQRBNPkqrbnp';

/**
 * Leest het stellingdeel van een FEN.
 * @param {string} fen
 * @returns {Record<string, string>} veldnaam ('e4') -> FEN-letter ('K', 'p', ...)
 */
export function boardFromFen(fen) {
  const placement = String(fen ?? '').trim().split(/\s+/)[0];
  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    throw new Error(`Ongeldige FEN: verwacht 8 rijen, kreeg ${ranks.length}`);
  }

  const board = {};
  ranks.forEach((rankText, index) => {
    const rank = 8 - index;
    let file = 0;
    for (const char of rankText) {
      if (char >= '1' && char <= '8') {
        file += Number(char);
      } else if (PIECES.includes(char)) {
        if (file < 8) board[`${FILES[file]}${rank}`] = char;
        file += 1;
      } else {
        throw new Error(`Ongeldige FEN: onbekend teken '${char}' in rij ${rank}`);
      }
    }
    if (file !== 8) {
      throw new Error(`Ongeldige FEN: rij ${rank} heeft ${file} velden in plaats van 8`);
    }
  });
  return board;
}
