// Gedeeld door de zoekfuncties van versie 1 en 2.
import { generateLegalMoves, isInCheck } from '../chess/movegen.js';
import { countRepetitions, isInsufficientMaterial } from '../chess/status.js';

/** Score voor mat. Een mat na n halve zetten scoort MATE - n, zodat sneller mat beter is. */
export const MATE = 100000;

/**
 * Remise volgens de zoekboom: te weinig materiaal, een stelling die al eerder
 * voorkwam (één herhaling telt al, anders loopt een engine die voor staat zo
 * een herhaling in), of de 50-zettenregel. Bij die laatste gaat mat voor,
 * net als in gameStatus.
 */
export function isDraw(pos) {
  if (isInsufficientMaterial(pos) || countRepetitions(pos) >= 2) return true;
  if (pos.halfmoveClock >= 100) return !(isInCheck(pos) && generateLegalMoves(pos).length === 0);
  return false;
}

/** Fisher-Yates: schudt de lijst op zijn plaats en geeft hem terug. */
export function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
