import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { rankCandidates } from '../src/research/ranking';

// SYNTHETIC: hand-written R-per-trade lists, as if from two real backtest runs.
describe('rankCandidates', () => {
  it('ranks by edge over the random baseline, best first', () => {
    const a = { id: 'a', label: 'A', trades: Array(30).fill(1), randomTrades: Array(30).fill(0) };
    const b = { id: 'b', label: 'B', trades: Array(30).fill(2), randomTrades: Array(30).fill(0) };
    const ranked = rankCandidates([a, b], mulberry32(1));
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
    expect(ranked[0]!.edgeR).toBeCloseTo(2, 9);
    expect(ranked[1]!.edgeR).toBeCloseTo(1, 9);
  });

  it('treats a missing random baseline as zero edge and flags hasRandomBaseline: false', () => {
    const ranked = rankCandidates(
      [{ id: 'a', label: 'A', trades: Array(30).fill(1) }],
      mulberry32(1),
    );
    expect(ranked[0]!.hasRandomBaseline).toBe(false);
    expect(ranked[0]!.edgeCI).toBeUndefined();
    expect(ranked[0]!.edgeR).toBeCloseTo(1, 9);
  });

  it('excludes candidates with fewer than 30 trades from ranking, placing them last', () => {
    const good = { id: 'good', label: 'Good', trades: Array(30).fill(1) };
    const tooFew = { id: 'few', label: 'Few', trades: [1, 1, 1] };
    const ranked = rankCandidates([tooFew, good], mulberry32(1));
    expect(ranked[0]!.id).toBe('good');
    expect(ranked[1]!.id).toBe('few');
    expect(ranked[1]!.excludedLowSample).toBe(true);
  });

  it('flags positiveExpectancy based on the candidate alone, independent of the random baseline', () => {
    const [negative] = rankCandidates(
      [{ id: 'a', label: 'A', trades: Array(30).fill(-1) }],
      mulberry32(1),
    );
    expect(negative!.positiveExpectancy).toBe(false);
    const [positive] = rankCandidates(
      [{ id: 'b', label: 'B', trades: Array(30).fill(1) }],
      mulberry32(1),
    );
    expect(positive!.positiveExpectancy).toBe(true);
  });

  it('computes a bootstrap CI for the edge that is deterministic for a given seed', () => {
    const trades = [1, 2, -1, 1, 0.5, -0.5, 2, 1, -1, 1.5];
    const randomTrades = [0, 0.2, -0.2, 0, 0.1, -0.1, 0.2, 0, -0.2, 0.1];
    const c = {
      id: 'a',
      label: 'A',
      trades: Array(3).fill(trades).flat(),
      randomTrades: Array(3).fill(randomTrades).flat(),
    };
    const r1 = rankCandidates([c], mulberry32(42));
    const r2 = rankCandidates([c], mulberry32(42));
    expect(r1[0]!.edgeCI).toEqual(r2[0]!.edgeCI);
    expect(r1[0]!.edgeCI!.low).toBeLessThanOrEqual(r1[0]!.edgeCI!.high);
    const r3 = rankCandidates([c], mulberry32(43));
    expect(r3[0]!.edgeCI).not.toEqual(r1[0]!.edgeCI);
  });
});
