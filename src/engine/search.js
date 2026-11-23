// Engine versie 2: iteratieve verdieping met een tijdslimiet, alfa-bèta met
// schaakverlenging, quiescence, een transpositietabel en zetordening
// (tabelzet, MVV-LVA, killer- en history-zetten).
import { makeMove, unmakeMove } from '../chess/position.js';
import { generateMoves, isInCheck } from '../chess/movegen.js';
import {
  PAWN, QUEEN, FLAG_CAPTURE, FLAG_EN_PASSANT,
  pieceType, moveFrom, moveTo, moveFlags, movePromotion,
} from '../chess/constants.js';
import { evaluate, PIECE_VALUES } from './evaluate.js';
import { MATE, isDraw, shuffle } from './common.js';

export { MATE };

const INFINITY = MATE + 1;
/** Scores voorbij deze grens zijn mat-scores. */
const MATE_BOUND = MATE - 1000;
const MAX_PLY = 64;
const TIME_CHECK_MASK = 1023; // elke 1024 knopen op de klok kijken

const TT_SIZE = 1 << 18;
const TT_MASK = TT_SIZE - 1;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

const ORDER_TT = 1e9;
const ORDER_CAPTURE = 1e8;
const ORDER_PROMOTION = 9e7;
const ORDER_KILLER_1 = 8e7;
const ORDER_KILLER_2 = 7e7;

/** Een mat-score in de tabel geldt vanaf de knoop, niet vanaf de wortel. */
const toTable = (score, ply) => (score > MATE_BOUND ? score + ply : score < -MATE_BOUND ? score - ply : score);
const fromTable = (score, ply) => (score > MATE_BOUND ? score - ply : score < -MATE_BOUND ? score + ply : score);

class Searcher {
  constructor({ now = () => 0, quiescence = true } = {}) {
    this.now = now;
    this.deadline = Infinity;
    this.quiescence = quiescence;
    this.stopped = false;
    this.nodes = 0;
    this.ttKeyLo = new Int32Array(TT_SIZE);
    this.ttKeyHi = new Int32Array(TT_SIZE);
    this.ttMove = new Int32Array(TT_SIZE);
    this.ttScore = new Int32Array(TT_SIZE);
    this.ttDepth = new Int8Array(TT_SIZE);
    this.ttFlag = new Uint8Array(TT_SIZE);
    this.killers = Array.from({ length: MAX_PLY + 1 }, () => [0, 0]);
    this.history = new Int32Array(128 * 128);
  }

  /** Telt een knoop en zet de stopvlag als de tijd op is. */
  tick() {
    this.nodes += 1;
    if ((this.nodes & TIME_CHECK_MASK) === 0 && this.deadline !== Infinity && this.now() > this.deadline) {
      this.stopped = true;
    }
    return this.stopped;
  }

  orderScore(pos, move, ttMove, ply) {
    if (move === ttMove) return ORDER_TT;
    const flags = moveFlags(move);
    if (flags & FLAG_CAPTURE) {
      const victim = flags & FLAG_EN_PASSANT ? PAWN : pieceType(pos.board[moveTo(move)]);
      const attacker = pieceType(pos.board[moveFrom(move)]);
      return ORDER_CAPTURE + PIECE_VALUES[victim] * 10 - PIECE_VALUES[attacker] / 100 + (movePromotion(move) === QUEEN ? 1 : 0);
    }
    if (movePromotion(move) === QUEEN) return ORDER_PROMOTION;
    const killers = this.killers[ply];
    if (move === killers[0]) return ORDER_KILLER_1;
    if (move === killers[1]) return ORDER_KILLER_2;
    return this.history[moveFrom(move) * 128 + moveTo(move)];
  }

  /** Sorteert zetten op hun ordeningsscore (stabiel, dus gelijke zetten houden hun volgorde). */
  ordered(pos, moves, ttMove, ply) {
    const scored = moves.map((move) => ({ move, score: this.orderScore(pos, move, ttMove, ply) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.move);
  }

  negamax(pos, depth, alpha, beta, ply) {
    if (this.tick()) return 0;
    if (ply > 0 && isDraw(pos)) return 0;
    if (ply >= MAX_PLY) return evaluate(pos);

    const inCheck = isInCheck(pos);
    if (inCheck) depth += 1; // schaakverlenging: een mat net achter de horizon blijft zichtbaar
    if (depth <= 0) return this.quiescence ? this.quiesce(pos, alpha, beta, ply) : evaluate(pos);

    const index = pos.hashLo & TT_MASK;
    let ttMove = 0;
    if (this.ttFlag[index] && this.ttKeyLo[index] === pos.hashLo && this.ttKeyHi[index] === pos.hashHi) {
      ttMove = this.ttMove[index];
      if (ply > 0 && this.ttDepth[index] >= depth) {
        const score = fromTable(this.ttScore[index], ply);
        const flag = this.ttFlag[index];
        if (flag === EXACT) return score;
        if (flag === LOWER && score >= beta) return beta;
        if (flag === UPPER && score <= alpha) return alpha;
      }
    }

    const us = pos.turn;
    const alphaStart = alpha;
    let bestMove = 0;
    let legal = 0;
    for (const move of this.ordered(pos, generateMoves(pos), ttMove, ply)) {
      makeMove(pos, move);
      if (isInCheck(pos, us)) {
        unmakeMove(pos);
        continue;
      }
      legal += 1;
      const score = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(pos);
      if (this.stopped) return 0;

      if (score >= beta) {
        if (!(moveFlags(move) & FLAG_CAPTURE) && !movePromotion(move)) {
          const killers = this.killers[ply];
          if (killers[0] !== move) {
            killers[1] = killers[0];
            killers[0] = move;
          }
          this.history[moveFrom(move) * 128 + moveTo(move)] += depth * depth;
        }
        this.store(index, pos, move, beta, depth, LOWER, ply);
        return beta;
      }
      if (score > alpha) {
        alpha = score;
        bestMove = move;
      }
    }

    if (legal === 0) return inCheck ? -(MATE - ply) : 0;
    this.store(index, pos, bestMove || ttMove, alpha, depth, alpha > alphaStart ? EXACT : UPPER, ply);
    return alpha;
  }

  /** Alleen slagzetten en promoties, tot de stelling rustig is. In schaak tellen alle zetten. */
  quiesce(pos, alpha, beta, ply) {
    if (this.tick()) return 0;
    if (ply >= MAX_PLY) return evaluate(pos);

    const inCheck = isInCheck(pos);
    if (!inCheck) {
      const standPat = evaluate(pos);
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    }

    let moves = generateMoves(pos);
    if (!inCheck) moves = moves.filter((move) => moveFlags(move) & FLAG_CAPTURE || movePromotion(move));

    const us = pos.turn;
    let legal = 0;
    for (const move of this.ordered(pos, moves, 0, ply)) {
      makeMove(pos, move);
      if (isInCheck(pos, us)) {
        unmakeMove(pos);
        continue;
      }
      legal += 1;
      const score = -this.quiesce(pos, -beta, -alpha, ply + 1);
      unmakeMove(pos);
      if (this.stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    if (inCheck && legal === 0) return -(MATE - ply);
    return alpha;
  }

  store(index, pos, move, score, depth, flag, ply) {
    this.ttKeyLo[index] = pos.hashLo;
    this.ttKeyHi[index] = pos.hashHi;
    this.ttMove[index] = move;
    this.ttScore[index] = toTable(score, ply);
    this.ttDepth[index] = Math.min(depth, 127);
    this.ttFlag[index] = flag;
  }

  /** Zoekt één diepte in de wortel. Geeft null als de tijd op raakte. */
  searchRoot(pos, depth, rootMoves) {
    let alpha = -INFINITY;
    let bestMove = rootMoves[0];
    for (const move of rootMoves) {
      makeMove(pos, move);
      const score = -this.negamax(pos, depth - 1, -INFINITY, -alpha, 1);
      unmakeMove(pos);
      if (this.stopped) return null;
      if (score > alpha) {
        alpha = score;
        bestMove = move;
      }
    }
    return { move: bestMove, score: alpha };
  }
}

/** Alle legale zetten (pseudo-legaal genereren, dan controleren). */
function legalMoves(pos) {
  const us = pos.turn;
  return generateMoves(pos).filter((move) => {
    makeMove(pos, move);
    const legal = !isInCheck(pos, us);
    unmakeMove(pos);
    return legal;
  });
}

/**
 * Zoekt de beste zet, steeds een diepte verder tot de tijd op is.
 * Diepte 1 wordt altijd afgemaakt; het antwoord komt van de laatste volledige diepte.
 * @param {import('../chess/position.js').Position} pos wordt tijdelijk gewijzigd, en daarna teruggezet
 * @returns {{ move: number | null, score: number, depth: number, nodes: number }}
 */
export function search(pos, { maxDepth = 64, timeMs = Infinity, random = Math.random, now = () => performance.now() } = {}) {
  const searcher = new Searcher({ now });
  const start = now();
  let rootMoves = shuffle(legalMoves(pos), random);
  if (rootMoves.length === 0) {
    return { move: null, score: isInCheck(pos) ? -MATE : 0, depth: 0, nodes: 1 };
  }

  let best = { move: rootMoves[0], score: 0, depth: 0 };
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (depth >= 2 && timeMs !== Infinity) {
      if (now() - start >= timeMs / 2) break; // een volgende diepte duurt meestal langer dan de vorige samen
      searcher.deadline = start + timeMs;
    }
    // Beste zet van de vorige diepte eerst; de rest stabiel op ordening, dus gelijke zetten blijven geschud.
    rootMoves = searcher.ordered(pos, rootMoves, best.move, 0);
    const result = searcher.searchRoot(pos, depth, rootMoves);
    if (!result) break;
    best = { move: result.move, score: result.score, depth };
    if (rootMoves.length === 1 || Math.abs(result.score) > MATE_BOUND) break;
  }
  return { ...best, nodes: searcher.nodes };
}

/**
 * Een score voor elke legale zet: zoeken op depth - 1 met een vol venster.
 * Zonder quiescence is diepte 0 gewoon de evaluatie: dan wordt terugslaan na de
 * horizon niet gezien (de "slordige" blik van de lage niveaus).
 * Met een marge zijn alleen zetten tot `margin` onder de beste exact; een zet
 * die verder onder de beste blijft, krijgt die ondergrens als score. Dat
 * scheelt veel rekenwerk, en met ruis van een vijfde van de marge kiest een
 * niveau zo'n zet toch vrijwel nooit.
 * @returns {Array<{ move: number, score: number }>}
 */
export function scoreMoves(pos, depth, { quiescence = true, margin = Infinity } = {}) {
  const searcher = new Searcher({ quiescence });
  let best = -INFINITY;
  return searcher.ordered(pos, legalMoves(pos), 0, 0).map((move) => {
    const floor = Math.max(-INFINITY, best - margin);
    makeMove(pos, move);
    const score = -searcher.negamax(pos, depth - 1, -INFINITY, -floor, 1);
    unmakeMove(pos);
    if (score > best) best = score;
    return { move, score };
  });
}
