// De vijf niveaus van de computer. De lage niveaus scoren elke zet en kiezen
// met ruis, en kijken soms slordig (zonder terugslaan); de hoge niveaus
// zoeken zo diep als in hun denktijd past.
import { search, scoreMoves } from './search.js';

/**
 * - depth + noise: elke zet een score op die diepte, plus ruis (centipionnen), de hoogste wint
 * - careless: kans per zet op een slordige blik (alleen de stelling direct na de eigen zet)
 * - timeMs: zoeken met iteratieve verdieping binnen die tijd
 */
export const LEVELS = Object.freeze(
  [
    { level: 1, name: 'Beginner', depth: 1, noise: 150, careless: 0.25 },
    { level: 2, name: 'Leerling', depth: 2, noise: 60, careless: 0.08 },
    { level: 3, name: 'Clubspeler', depth: 3, noise: 20 },
    { level: 4, name: 'Sterk', timeMs: 700 },
    { level: 5, name: 'Maximaal', timeMs: 2000 },
  ].map(Object.freeze),
);

/** Normaal verdeeld toevalsgetal (Box-Muller). */
function gaussian(random) {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/**
 * Kiest een zet op het gegeven niveau.
 * @param {{ random?: () => number, timeScale?: number }} [options] timeScale verkort de denktijd (voor tests)
 * @returns {{ move: number | null, score: number }}
 */
export function chooseMove(pos, level, { random = Math.random, timeScale = 1 } = {}) {
  const settings = LEVELS.find((entry) => entry.level === level);
  if (!settings) throw new Error(`Onbekend niveau: ${level}`);

  if (!settings.noise) {
    const { move, score } = search(pos, { timeMs: settings.timeMs * timeScale, random });
    return { move, score };
  }

  const careless = random() < (settings.careless ?? 0);
  const scored = careless ? scoreMoves(pos, 1, { quiescence: false }) : scoreMoves(pos, settings.depth);
  let best = null;
  let bestValue = -Infinity;
  for (const entry of scored) {
    const value = entry.score + settings.noise * gaussian(random);
    if (value > bestValue) {
      bestValue = value;
      best = entry;
    }
  }
  return best ? { move: best.move, score: best.score } : { move: null, score: 0 };
}
