// Denktijd per niveau op drukke stellingen. Start met: npm run bench
import { fromFen } from '../src/chess/position.js';
import { LEVELS, chooseMove } from '../src/engine/levels.js';
import { createRandom } from '../src/engine/random.js';
import { PERFT_FENS } from '../tests/chess/fixtures.js';

let failed = false;
for (const { level, name, timeMs } of LEVELS) {
  const limit = timeMs ? timeMs * 1.15 : 500;
  let longest = 0;
  for (const fenName of ['kiwipete', 'pos6']) {
    for (let seed = 1; seed <= 3; seed++) {
      const start = performance.now();
      chooseMove(fromFen(PERFT_FENS[fenName]), level, { random: createRandom(seed) });
      longest = Math.max(longest, performance.now() - start);
    }
  }
  const ok = longest < limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FOUT'} niveau ${level} (${name}): langste zet ${longest.toFixed(0)} ms (grens ${limit.toFixed(0)} ms)`);
}
process.exitCode = failed ? 1 : 0;
