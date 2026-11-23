// Diepe perft-controle met snelheidsmeting. Start met: npm run perft
import { fromFen } from '../src/chess/position.js';
import { perft } from '../src/chess/perft.js';

// Bron: chessprogramming.org/Perft_Results
const CASES = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 5, 4865609],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 4, 4085603],
  ['pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 4, 2103487],
  ['pos6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', 4, 3894594],
];

let failed = false;
let totalNodes = 0;
let totalMs = 0;

for (const [name, fen, depth, expected] of CASES) {
  const start = performance.now();
  const nodes = perft(fromFen(fen), depth);
  const ms = performance.now() - start;
  totalNodes += nodes;
  totalMs += ms;
  const ok = nodes === expected;
  if (!ok) failed = true;
  const speed = Math.round(nodes / (ms / 1000)).toLocaleString('nl-NL');
  console.log(
    `${ok ? 'OK  ' : 'FOUT'} ${name.padEnd(9)} diepte ${depth}: ${nodes.toLocaleString('nl-NL').padStart(10)}` +
      (ok ? '' : ` (verwacht ${expected.toLocaleString('nl-NL')})`) +
      `  ${(ms / 1000).toFixed(2)} s  ${speed} knopen/s`,
  );
}

const overall = Math.round(totalNodes / (totalMs / 1000)).toLocaleString('nl-NL');
console.log(`\nTotaal: ${totalNodes.toLocaleString('nl-NL')} knopen in ${(totalMs / 1000).toFixed(1)} s (${overall} knopen/s)`);
process.exit(failed ? 1 : 0);
