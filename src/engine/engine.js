// Vertaalt een verzoek (beginstelling plus gespeelde zetten) naar een zet.
// Puur en zonder DOM: de worker en het wedstrijdscript gebruiken dit allebei.
import { fromFen, makeMove } from '../chess/position.js';
import { moveFromUci, moveToUci } from '../chess/notation.js';
import { search } from './search.js';
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
 * @param {{ id: number, startFen: string, moves: string[], depth: number, seed?: number }} request
 * @returns {{ id: number, move: string | null, score: number, nodes: number } | { id: number, error: string }}
 */
export function handleRequest({ id, startFen, moves, depth, seed }) {
  try {
    const pos = positionFromMoves(startFen, moves);
    const random = seed === undefined ? Math.random : createRandom(seed);
    const { move, score, nodes } = search(pos, { depth, random });
    return { id, move: moveToUci(move), score, nodes };
  } catch (error) {
    return { id, error: error.message };
  }
}
