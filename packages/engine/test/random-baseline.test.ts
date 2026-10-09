import { describe, expect, it } from 'vitest';
import { randomEntryBaseline, type RandomBaselineInput } from '../src/backtest/random-baseline';
import { seriesFromRows } from '../src/data/columnar';
import { mulberry32, randomInt } from '../src/core/rng';
import { EUR, MIN, syntheticMinutes } from './helpers/synthetic-minutes';

function input(overrides: Partial<RandomBaselineInput> = {}): RandomBaselineInput {
  const rows = syntheticMinutes('2026-01-05T00:00:00Z', '2026-03-05T00:00:00Z', 11, 3);
  const series = seriesFromRows(rows, false);
  return {
    inst: EUR,
    series,
    baseMs: MIN,
    range: { from: series.t[0]!, to: series.t[series.length - 1]! },
    direction: 'LONG',
    count: 10,
    stopPips: 10,
    targetR: 2,
    risk: { percentPerTrade: 1 },
    costs: { spreadPips: 0.2, slippagePips: 0.1, commissionPerLotPerSide: 3.5 },
    ambiguity: 'STOP_FIRST',
    startEquity: 10_000,
    lots: { lotStep: 0.01, minLot: 0.01 },
    seed: 42,
    ...overrides,
  };
}

describe('mulberry32 / randomInt', () => {
  it('is deterministic for a given seed and spreads across the full range', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    const c = mulberry32(8);
    expect(Array.from({ length: 20 }, () => c())).not.toEqual(seqA);
  });

  it('randomInt stays within [0, n) and is deterministic', () => {
    const rng = mulberry32(3);
    const draws = Array.from({ length: 200 }, () => randomInt(rng, 5));
    expect(draws.every((x) => x >= 0 && x < 5)).toBe(true);
    expect(new Set(draws).size).toBeGreaterThan(1);
  });
});

describe('randomEntryBaseline', () => {
  it('produces the requested number of non-overlapping trades, deterministically', () => {
    const a = randomEntryBaseline(input());
    const b = randomEntryBaseline(input());
    expect(a).toEqual(b);
    expect(a.trades).toHaveLength(10);
    for (let i = 1; i < a.trades.length; i++) {
      expect(a.trades[i]!.entryAt).toBeGreaterThanOrEqual(a.trades[i - 1]!.exitAt);
    }
  });

  it('a different seed gives a different (but still valid) sequence of entries', () => {
    const a = randomEntryBaseline(input({ seed: 42 }));
    const b = randomEntryBaseline(input({ seed: 99 }));
    expect(a.trades.map((t) => t.entryAt)).not.toEqual(b.trades.map((t) => t.entryAt));
    expect(b.trades.length).toBeGreaterThan(0);
  });

  it('every trade uses the requested stop distance and target R (before cost adjustment)', () => {
    const r = randomEntryBaseline(input({ count: 15, stopPips: 10, targetR: 3 }));
    for (const t of r.trades) {
      const stopDist = Math.abs(t.order.referencePrice - t.order.stop);
      const targetDist = Math.abs(t.order.target - t.order.referencePrice);
      expect(stopDist).toBeCloseTo(0.001, 5); // 10 pips on EURUSD
      expect(targetDist / stopDist).toBeCloseTo(3, 5);
    }
  });

  it('stops early (fewer trades) when the range runs out of room', () => {
    const r = randomEntryBaseline(input({ count: 10_000 }));
    expect(r.trades.length).toBeLessThan(10_000);
    expect(r.trades.length).toBeGreaterThan(0);
  });
});
