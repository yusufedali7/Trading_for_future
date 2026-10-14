import { mulberry32, randomInt, type Rng } from '../core/rng';
import type { Bars } from '../features/bars';
import type { Fvg, Swing, SwingParams } from '../features/types';

/**
 * Practice questions (D74) built from the engine's own detections on real data. Each question is
 * stated with only the bars up to `cursorIndex`; its answer comes from the detectors and is shown
 * once the data reaches `revealIndex` (rule 3: a swing is known only after its right-hand bars).
 * Question choice is seeded (rule 5). The quiz measures recognition of definitions - it never asks
 * the learner to predict a price move.
 */

export type QuizKind = 'SWING' | 'FVG';

export interface QuizQuestion {
  /** Deterministic: kind, side and the bar asked about. */
  id: string;
  kind: QuizKind;
  side: 'HIGH' | 'LOW' | 'BULLISH' | 'BEARISH';
  /** Last closed bar the learner sees while answering. */
  cursorIndex: number;
  /** The bar the question is about (a swing candidate, or the middle bar of a three-bar gap). */
  subjectIndex: number;
  answer: boolean;
  /** Bar after whose close the answer is known; the view advances to it after answering. */
  revealIndex: number;
}

export interface QuizInput {
  bars: Bars;
  features: { swings: readonly Swing[]; fvgs: readonly Fvg[] };
  /** The swing definition the detections were made with. */
  swing: SwingParams;
  kinds: readonly QuizKind[];
  count: number;
  seed: number;
  /** Bars that must exist before a question's bar, so every question has context. Default 0. */
  minHistory?: number;
}

function swingCandidates(b: Bars, swings: readonly Swing[], p: SwingParams): QuizQuestion[] {
  // With a 1-bar confirmation delay the answer is already known one bar after the candidate.
  if (p.right < 2) return [];
  const known = new Set(swings.map((s) => `${s.kind}:${s.formedIndex}`));
  const out: QuizQuestion[] = [];
  for (let i = p.left; i + p.right < b.length; i++) {
    for (const side of ['HIGH', 'LOW'] as const) {
      const beyond = (k: number) => (side === 'HIGH' ? b.h[k]! < b.h[i]! : b.l[k]! > b.l[i]!);
      let candidate = true;
      for (let k = i - p.left; k < i && candidate; k++) candidate = beyond(k);
      const next = side === 'HIGH' ? b.h[i + 1]! <= b.h[i]! : b.l[i + 1]! >= b.l[i]!;
      if (!candidate || !next) continue;
      out.push({
        id: `SWING:${side}:${b.t[i]}`,
        kind: 'SWING',
        side,
        cursorIndex: i + 1,
        subjectIndex: i,
        answer: known.has(`${side}:${i}`),
        revealIndex: i + p.right,
      });
    }
  }
  return out;
}

function fvgCandidates(b: Bars, fvgs: readonly Fvg[]): QuizQuestion[] {
  const known = new Set(fvgs.map((f) => `${f.direction}:${f.confirmedIndex}`));
  const out: QuizQuestion[] = [];
  for (let k = 2; k < b.length; k++)
    for (const side of ['BULLISH', 'BEARISH'] as const)
      out.push({
        id: `FVG:${side}:${b.t[k]}`,
        kind: 'FVG',
        side,
        cursorIndex: k,
        subjectIndex: k - 1,
        answer: known.has(`${side}:${k}`),
        revealIndex: k,
      });
  return out;
}

function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Up to `half` "yes" and the rest "no" from one kind's pool, topping up from "yes". */
function pick(pool: readonly QuizQuestion[], n: number, rng: Rng): QuizQuestion[] {
  const yes = shuffled(
    pool.filter((q) => q.answer),
    rng,
  );
  const no = shuffled(
    pool.filter((q) => !q.answer),
    rng,
  );
  const nYes = Math.min(yes.length, Math.ceil(n / 2));
  const nNo = Math.min(no.length, n - nYes);
  const out = [...yes.slice(0, nYes), ...no.slice(0, nNo)];
  out.push(...yes.slice(nYes, nYes + (n - out.length)));
  return out;
}

/**
 * `count` questions split evenly across `kinds`, each kind about half "yes" - balanced per kind, so
 * the kind of question never gives its answer away - in the order the learner meets them.
 */
export function buildQuiz(input: QuizInput): QuizQuestion[] {
  const { bars, features, kinds, count } = input;
  const minHistory = input.minHistory ?? 0;
  const rng = mulberry32(input.seed);
  const picked: QuizQuestion[] = [];
  kinds.forEach((kind, i) => {
    const pool = (
      kind === 'SWING'
        ? swingCandidates(bars, features.swings, input.swing)
        : fvgCandidates(bars, features.fvgs)
    ).filter((q) => q.subjectIndex >= minHistory);
    const n = Math.floor(count / kinds.length) + (i < count % kinds.length ? 1 : 0);
    picked.push(...pick(pool, n, rng));
  });
  return picked.sort((a, b) => a.cursorIndex - b.cursorIndex || a.id.localeCompare(b.id));
}
