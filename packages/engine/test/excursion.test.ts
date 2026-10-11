import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import type { DetectionRef } from '../src/features/outcomes';
import {
  batchExcursions,
  detectionExcursions,
  summarizeExcursions,
  type ExcursionReport,
} from '../src/research/excursion';
import { bars } from './helpers/synthetic-bars';

describe('detectionExcursions', () => {
  it('measures MFE/MAE in the expected direction, growing (never shrinking) with the horizon', () => {
    // SYNTHETIC: confirmation close 1.1000, then rises to 1.1020 (favorable for BULLISH),
    // dips to 1.0990 (adverse), then flat.
    const b = bars([
      [1.1, 1.1005, 1.0995, 1.1], // confirmedIndex = 0, entry price 1.1
      [1.1, 1.101, 1.0995, 1.1005], // k=1: favorable 0.001, adverse 0.0005
      [1.1005, 1.102, 1.0998, 1.1015], // k=2: favorable 0.002 (new MFE), adverse 0.0002
      [1.1015, 1.1015, 1.099, 1.0995], // k=3: favorable 0.0015, adverse 0.001 (new MAE)
      [1.0995, 1.1, 1.0985, 1.0995], // k=4: favorable 0, adverse 0.0015 (new MAE)
    ]);
    const rng = mulberry32(1);
    const r = detectionExcursions(
      b,
      { id: 'x', confirmedIndex: 0, direction: 'BULLISH' },
      [2, 4],
      rng,
    );
    expect(r.excursions[0]!.horizonBars).toBe(2);
    expect(r.excursions[0]!.mfe).toBeCloseTo(0.002, 6);
    expect(r.excursions[0]!.mae).toBeCloseTo(0.0005, 6);
    expect(r.excursions[1]!.horizonBars).toBe(4);
    expect(r.excursions[1]!.mfe).toBeCloseTo(0.002, 6);
    expect(r.excursions[1]!.mae).toBeCloseTo(0.0015, 6);
    // Monotonic: the longer horizon's MFE/MAE is never less than the shorter one's.
    expect(r.excursions[1]!.mfe).toBeGreaterThanOrEqual(r.excursions[0]!.mfe);
    expect(r.excursions[1]!.mae).toBeGreaterThanOrEqual(r.excursions[0]!.mae);
  });

  it('mirrors for BEARISH: favorable is downward, adverse is upward', () => {
    const b = bars([
      [1.1, 1.1005, 1.0995, 1.1],
      [1.1, 1.1003, 1.098, 1.0985], // low 1.098 -> favorable 0.002
      [1.0985, 1.1015, 1.098, 1.1], // high 1.1015 -> adverse 0.0015
    ]);
    const rng = mulberry32(1);
    const r = detectionExcursions(
      b,
      { id: 'x', confirmedIndex: 0, direction: 'BEARISH' },
      [2],
      rng,
    );
    expect(r.excursions[0]!.horizonBars).toBe(2);
    expect(r.excursions[0]!.mfe).toBeCloseTo(0.002, 6);
    expect(r.excursions[0]!.mae).toBeCloseTo(0.0015, 6);
  });

  it('is null (pending) while the horizon has not closed yet - no lookahead', () => {
    const b = bars(Array.from({ length: 3 }, () => [1.1, 1.1005, 1.0995, 1.1] as const));
    const rng = mulberry32(1);
    const r = detectionExcursions(
      b,
      { id: 'x', confirmedIndex: 0, direction: 'BULLISH' },
      [5],
      rng,
    );
    expect(r.excursions[0]).toBeNull();
    expect(r.control[0]).toBeNull();
  });

  it('the control is deterministic for a given seed and differs across seeds', () => {
    const b = bars(
      Array.from({ length: 200 }, (_, i) => {
        const p = 1.1 + (i % 7) * 0.0002;
        return [p, p + 0.0005, p - 0.0005, p] as const;
      }),
    );
    const d = { id: 'x', confirmedIndex: 10, direction: 'BULLISH' as const };
    const a = detectionExcursions(b, d, [5, 10], mulberry32(7));
    const a2 = detectionExcursions(b, d, [5, 10], mulberry32(7));
    expect(a.control).toEqual(a2.control);
    const c = detectionExcursions(b, d, [5, 10], mulberry32(8));
    expect(c.control).not.toEqual(a.control);
  });
});

describe('batchExcursions (D66)', () => {
  it('tags each report with its concept and shares one advancing rng across the batch', () => {
    const b = bars(
      Array.from({ length: 50 }, (_, i) => {
        const p = 1.1 + (i % 7) * 0.0002;
        return [p, p + 0.0005, p - 0.0005, p] as const;
      }),
    );
    const refs: DetectionRef[] = [
      {
        id: 'sw1',
        concept: 'SWING',
        direction: 'BULLISH',
        formedAt: 0,
        confirmedAt: 0,
        confirmedIndex: 5,
      },
      {
        id: 'fv1',
        concept: 'FVG',
        direction: 'BEARISH',
        formedAt: 0,
        confirmedAt: 0,
        confirmedIndex: 10,
      },
    ];
    const a = batchExcursions(b, refs, [5], mulberry32(3));
    expect(a.map((r) => [r.id, r.concept])).toEqual([
      ['sw1', 'SWING'],
      ['fv1', 'FVG'],
    ]);
    // A shared, advancing rng: the second report's control differs from what it would be if it
    // (wrongly) reused the first report's rng state from scratch.
    const soloSecond = batchExcursions(b, [refs[1]!], [5], mulberry32(3));
    expect(a[1]!.control).not.toEqual(soloSecond[0]!.control);
    // Deterministic for the same seed.
    const a2 = batchExcursions(b, refs, [5], mulberry32(3));
    expect(a2).toEqual(a);
  });
});

describe('summarizeExcursions', () => {
  it('averages only the horizons known so far, for both real and control', () => {
    const reports: ExcursionReport[] = [
      {
        id: 'a',
        excursions: [
          { horizonBars: 10, mfe: 0.001, mae: 0.0005 },
          { horizonBars: 20, mfe: 0.002, mae: 0.0008 },
        ],
        control: [
          { horizonBars: 10, mfe: 0.0003, mae: 0.0003 },
          { horizonBars: 20, mfe: 0.0006, mae: 0.0006 },
        ],
      },
      {
        id: 'b',
        excursions: [{ horizonBars: 10, mfe: 0.003, mae: 0.0015 }, null],
        control: [{ horizonBars: 10, mfe: 0.0009, mae: 0.0009 }, null],
      },
    ];
    const sum = summarizeExcursions(reports, [10, 20]);
    expect(sum[0]).toEqual({
      horizonBars: 10,
      n: 2,
      avgMfe: (0.001 + 0.003) / 2,
      avgMae: (0.0005 + 0.0015) / 2,
      controlN: 2,
      controlAvgMfe: (0.0003 + 0.0009) / 2,
      controlAvgMae: (0.0003 + 0.0009) / 2,
    });
    expect(sum[1]).toMatchObject({ horizonBars: 20, n: 1, controlN: 1 });
  });
});
