// Vertaalt een verzoek (beginstelling, gespeelde zetten, niveau) naar een zet.
// Puur en zonder DOM: de worker en het wedstrijdscript gebruiken dit allebei.
import { fromFen, makeMove } from '../chess/position.js';
import { moveFromUci, moveToUci } from '../chess/notation.js';
import { chooseMove } from './levels.js';
import { createRandom } from './random.js';

/** De stelling na de gespeelde zetten, met geschiedenis (voor herhaling). */
export function positionFromMoves(startFen, moves) {
  const pos = fromFen(startFen);
  for (const uci of moves) {
    const move = moveFromUci(pos, uci);
    if (move === null) throw new Error(`Ongeldige zet: ${uci}`);
    makeMove(pos, move);
  }
  return pos;
}

/**
 * Gooit nooit: elke fout wordt een antwoord met `error`.
 * @param {{ id: number, startFen: string, moves: string[], level: number, seed?: number, timeScale?: number }} request
 * @returns {{ id: number, move: string | null, score: number } | { id: number, error: string }}
 */
export function handleRequest(request) {
  const id = request?.id;
  try {
    const { startFen, moves, level, seed, timeScale = 1 } = request;
    const pos = positionFromMoves(startFen, moves);
    const random = seed === undefined ? Math.random : createRandom(seed);
    const { move, score } = chooseMove(pos, level, { random, timeScale });
    return { id, move: moveToUci(move), score };
  } catch (error) {
    return { id, error: error.message };
  }
}
