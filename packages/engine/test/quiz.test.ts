import { describe, expect, it } from 'vitest';
import type { Bars } from '../src/features/bars';
import { detectFvgs } from '../src/features/fvg';
import { detectSwings, SWING_DEFAULTS } from '../src/features/swing';
import { getInstrument } from '../src/instruments/registry';
import { buildQuiz, type QuizInput } from '../src/education/quiz';

const EUR = getInstrument('EURUSD');

/** SYNTHETIC: 400 deterministic wave-plus-noise bars with real swings and gaps in both directions. */
function bars(n = 400): Bars {
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];
  let prev = 1.1;
  for (let i = 0; i < n; i++) {
    const wave = 0.002 * Math.sin((2 * Math.PI * i) / 23) + 0.001 * Math.sin((2 * Math.PI * i) / 7);
    const close = Math.round((1.1 + wave + ((i * 37) % 11) / 50_000) * 1e5) / 1e5;
    const open = prev;
    o.push(open);
    c.push(close);
    h.push(Math.max(open, close) + ((i * 13) % 5) / 100_000 + 0.00005);
    l.push(Math.min(open, close) - ((i * 7) % 5) / 100_000 - 0.00005);
    prev = close;
  }
  const t = Array.from({ length: n }, (_, i) => Date.parse('2026-01-06T00:00:00Z') + i * 60_000);
  return { length: n, t, o, h, l, c, end: t.map((x) => x + 60_000), v: t.map(() => 0) };
}

function input(over: Partial<QuizInput> = {}): QuizInput {
  const b = bars();
  return {
    bars: b,
    features: { swings: detectSwings(b), fvgs: detectFvgs(b, EUR, { minSizePips: 0 }) },
    swing: SWING_DEFAULTS,
    kinds: ['SWING', 'FVG'],
    count: 12,
    seed: 7,
    ...over,
  };
}

describe('buildQuiz (D74)', () => {
  it('is deterministic for a seed and changes with it (rule 5)', () => {
    expect(buildQuiz(input())).toEqual(buildQuiz(input()));
    expect(buildQuiz(input({ seed: 8 }))).not.toEqual(buildQuiz(input()));
  });

  it('asks the requested number of questions in time order, half of them with a "yes" answer', () => {
    const q = buildQuiz(input());
    expect(q).toHaveLength(12);
    expect(q.map((x) => x.cursorIndex)).toEqual(
      [...q.map((x) => x.cursorIndex)].sort((a, b) => a - b),
    );
    expect(q.filter((x) => x.answer)).toHaveLength(6);
    expect(new Set(q.map((x) => x.id)).size).toBe(12);
  });

  it('balances "yes" and "no" within each kind, so the kind never gives the answer away', () => {
    const q = buildQuiz(input({ count: 12 }));
    for (const kind of ['SWING', 'FVG'] as const) {
      const k = q.filter((x) => x.kind === kind);
      expect(k).toHaveLength(6);
      expect(k.filter((x) => x.answer)).toHaveLength(3);
    }
  });

  it('leaves at least `minHistory` bars of context before every question', () => {
    const q = buildQuiz(input({ count: 20, minHistory: 40 }));
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((x) => x.subjectIndex >= 40)).toBe(true);
  });

  it('only uses the requested kinds', () => {
    expect(buildQuiz(input({ kinds: ['FVG'] })).every((x) => x.kind === 'FVG')).toBe(true);
    expect(buildQuiz(input({ kinds: ['SWING'] })).every((x) => x.kind === 'SWING')).toBe(true);
  });

  it('answers swing questions from the detector, known only after the cursor (no lookahead)', () => {
    const inp = input({ kinds: ['SWING'], count: 20 });
    const { h, l } = inp.bars;
    for (const q of buildQuiz(inp)) {
      const i = q.subjectIndex;
      expect(q.cursorIndex).toBe(i + 1);
      expect(q.revealIndex).toBe(i + SWING_DEFAULTS.right);
      expect(q.revealIndex).toBeGreaterThan(q.cursorIndex);
      const isSwing = inp.features.swings.some((s) => s.formedIndex === i && s.kind === q.side);
      expect(q.answer).toBe(isSwing);
      // What the learner sees at the cursor makes the bar a fair candidate: strictly beyond the
      // bars on its left and not exceeded by the one bar shown on its right.
      for (let k = i - SWING_DEFAULTS.left; k < i; k++)
        if (q.side === 'HIGH') expect(h[k]!).toBeLessThan(h[i]!);
        else expect(l[k]!).toBeGreaterThan(l[i]!);
      if (q.side === 'HIGH') expect(h[i + 1]!).toBeLessThanOrEqual(h[i]!);
      else expect(l[i + 1]!).toBeGreaterThanOrEqual(l[i]!);
    }
  });

  it('answers gap questions from the detector at the cursor bar', () => {
    const inp = input({ kinds: ['FVG'], count: 20 });
    for (const q of buildQuiz(inp)) {
      expect(q.revealIndex).toBe(q.cursorIndex);
      expect(q.subjectIndex).toBe(q.cursorIndex - 1);
      const gap = inp.features.fvgs.some(
        (f) => f.confirmedIndex === q.cursorIndex && f.direction === q.side,
      );
      expect(q.answer).toBe(gap);
    }
  });

  it('asks nothing it cannot answer from the data it has', () => {
    const short = bars(5);
    const q = buildQuiz({
      ...input(),
      bars: short,
      features: { swings: detectSwings(short), fvgs: detectFvgs(short, EUR, { minSizePips: 0 }) },
    });
    for (const x of q) expect(x.revealIndex).toBeLessThan(short.length);
  });
});
