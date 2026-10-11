import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectFvgs } from '../src/features/fvg';
import {
  collectDetections,
  featureOutcomes,
  candidateOutcome,
  summarizeOutcomes,
  type CandidateOutcome,
} from '../src/features/outcomes';
import { detectStructureBreaks } from '../src/features/structure';
import { detectSwings } from '../src/features/swing';
import type { Fvg, LiquiditySweep, StructureBreak, Swing } from '../src/features/types';
import { getInstrument } from '../src/instruments/registry';
import { BAR_MS, T0, bars, randomWalk } from './helpers/synthetic-bars';

const EUR = getInstrument('EURUSD');
const end = (i: number) => T0 + (i + 1) * BAR_MS;
const timing = (confirmedIndex: number) => ({
  id: `X:${confirmedIndex}`,
  defVersion: 'v1' as const,
  formedAt: T0,
  formedIndex: 0,
  confirmedAt: end(confirmedIndex),
  confirmedIndex,
});
/** SYNTHETIC: bars whose only meaningful value is the close. */
const closes = (cs: readonly number[]) => bars(cs.map((c) => [c, c, c, c] as const));

describe('candidateOutcome (outcome-v1)', () => {
  const swingHigh: Swing = { ...timing(1), type: 'SWING', kind: 'HIGH', price: 1.1 };

  it('a swing high fails at the first close above it within the horizon', () => {
    const b = closes([1.09, 1.095, 1.099, 1.1, 1.1001, 1.09]);
    expect(candidateOutcome(b, swingHigh, { horizonBars: 4 })).toEqual({
      id: 'X:1',
      status: 'FAILED',
      failedAt: end(4),
      resolvedAt: end(4),
    });
  });

  it('a close exactly at the level is not beyond it; after the horizon the level held', () => {
    const b = closes([1.09, 1.095, 1.1, 1.1, 1.099, 1.2]);
    expect(candidateOutcome(b, swingHigh, { horizonBars: 3 })).toEqual({
      id: 'X:1',
      status: 'HELD',
      failedAt: null,
      resolvedAt: end(4),
    });
  });

  it('is pending while the horizon is not complete (no lookahead)', () => {
    const b = closes([1.09, 1.095, 1.099, 1.098]);
    expect(candidateOutcome(b, swingHigh, { horizonBars: 3 }).status).toBe('PENDING');
    expect(candidateOutcome(b, swingHigh, { horizonBars: 2 }).status).toBe('HELD');
  });

  it('uses the far edge of a gap, the broken level and the sweep wick, by direction', () => {
    const b = closes([1.1, 1.1, 1.0995, 1.1]);
    const h = { horizonBars: 2 };
    const gap: Fvg = {
      ...timing(1),
      type: 'FVG',
      direction: 'BULLISH',
      top: 1.101,
      bottom: 1.0998,
      touchedAt: null,
      filledAt: null,
    };
    expect(candidateOutcome(b, gap, h).status).toBe('FAILED');
    expect(
      candidateOutcome(b, { ...gap, direction: 'BEARISH', bottom: 1.099, top: 1.1 }, h).status,
    ).toBe('HELD');
    const brk: StructureBreak = {
      ...timing(1),
      type: 'STRUCTURE_BREAK',
      direction: 'BULLISH',
      kind: 'BOS',
      level: 1.0999,
      swingId: 's',
      swingAt: T0,
    };
    expect(candidateOutcome(b, brk, h).status).toBe('FAILED');
    expect(candidateOutcome(b, { ...brk, level: 1.099 }, h).status).toBe('HELD');
    const sweep: LiquiditySweep = {
      ...timing(1),
      type: 'LIQUIDITY_SWEEP',
      direction: 'BEARISH',
      levelId: 'l',
      levelKind: 'PDH',
      level: 1.0995,
      extreme: 1.0999,
    };
    expect(candidateOutcome(b, sweep, h).status).toBe('FAILED');
    expect(candidateOutcome(b, { ...sweep, extreme: 1.1 }, h).status).toBe('HELD');
  });
});

describe('featureOutcomes', () => {
  const b = randomWalk(400, 7);
  const swings = detectSwings(b, { left: 3, right: 3 });
  const features = {
    swings,
    fvgs: detectFvgs(b, EUR, { minSizePips: 1 }),
    breaks: detectStructureBreaks(b, swings, { breakBy: 'CLOSE' }),
    sweeps: [],
  };
  const p = { horizonBars: 12 };

  it('covers every candidate and is deterministic', () => {
    const a = featureOutcomes(b, features, p);
    expect(a.SWING).toHaveLength(swings.length);
    expect(a.FVG).toHaveLength(features.fvgs.length);
    expect(a.STRUCTURE_BREAK).toHaveLength(features.breaks.length);
    expect(featureOutcomes(b, features, p)).toEqual(a);
    expect(a.SWING.some((o) => o.status === 'FAILED')).toBe(true);
    expect(a.SWING.some((o) => o.status === 'HELD')).toBe(true);
  });

  it('the 4 SMC outcome concepts (D59) are empty without smc and populated with it', () => {
    const noSmc = featureOutcomes(b, features, p);
    expect(noSmc.ORDER_BLOCK).toEqual([]);
    expect(noSmc.IFVG).toEqual([]);
    expect(noSmc.BREAKER).toEqual([]);
    expect(noSmc.OTE).toEqual([]);
    const orderBlock = {
      id: 'ob1',
      defVersion: 'v1' as const,
      type: 'ORDER_BLOCK' as const,
      direction: 'BULLISH' as const,
      top: 1.1003,
      bottom: 1.1001,
      breakId: 'b',
      formedAt: T0,
      formedIndex: 0,
      confirmedAt: end(1),
      confirmedIndex: 1,
    };
    const withSmc = featureOutcomes(b, features, p, {
      orderBlocks: [orderBlock],
      ifvgs: [],
      breakers: [],
      ote: [],
    });
    expect(withSmc.ORDER_BLOCK).toHaveLength(1);
    expect(withSmc.ORDER_BLOCK[0]!.id).toBe('ob1');
  });

  it('cutting the data never changes an outcome that was already decided', () => {
    const full = featureOutcomes(b, features, p);
    for (let k = 20; k <= b.length; k += 17) {
      const cut = sliceBars(b, k);
      const known = <T extends { confirmedIndex: number }>(xs: T[]) =>
        xs.filter((d) => d.confirmedIndex < k);
      const part = featureOutcomes(
        cut,
        {
          swings: known(features.swings),
          fvgs: known(features.fvgs),
          breaks: known(features.breaks),
          sweeps: [],
        },
        p,
      );
      for (const kind of ['SWING', 'FVG', 'STRUCTURE_BREAK'] as const) {
        const byId = new Map(full[kind].map((o) => [o.id, o]));
        for (const o of part[kind]) {
          if (o.status === 'PENDING') continue;
          expect(o).toEqual(byId.get(o.id));
          expect(o.resolvedAt!).toBeLessThanOrEqual(cut.end[k - 1]!);
        }
      }
    }
  });
});

describe('collectDetections (D66)', () => {
  const b = randomWalk(400, 7);
  const swings = detectSwings(b, { left: 3, right: 3 });
  const features = {
    swings,
    fvgs: detectFvgs(b, EUR, { minSizePips: 1 }),
    breaks: detectStructureBreaks(b, swings, { breakBy: 'CLOSE' }),
    sweeps: [],
  };

  it('flattens every concept with the right count, id and direction', () => {
    const refs = collectDetections(features);
    expect(refs.filter((r) => r.concept === 'SWING')).toHaveLength(swings.length);
    expect(refs.filter((r) => r.concept === 'FVG')).toHaveLength(features.fvgs.length);
    expect(refs.filter((r) => r.concept === 'STRUCTURE_BREAK')).toHaveLength(
      features.breaks.length,
    );
    const bySwingId = new Map(swings.map((s) => [s.id, s]));
    for (const r of refs.filter((r) => r.concept === 'SWING')) {
      const s = bySwingId.get(r.id)!;
      expect(r.direction).toBe(s.kind === 'LOW' ? 'BULLISH' : 'BEARISH');
      expect(r.confirmedIndex).toBe(s.confirmedIndex);
    }
  });

  it('SMC concepts are empty without smc and populated with it', () => {
    expect(collectDetections(features).filter((r) => r.concept === 'ORDER_BLOCK')).toEqual([]);
    const orderBlock = {
      id: 'ob1',
      defVersion: 'v1' as const,
      type: 'ORDER_BLOCK' as const,
      direction: 'BULLISH' as const,
      top: 1.1003,
      bottom: 1.1001,
      breakId: 'b',
      formedAt: T0,
      formedIndex: 0,
      confirmedAt: end(1),
      confirmedIndex: 1,
    };
    const refs = collectDetections(features, {
      orderBlocks: [orderBlock],
      ifvgs: [],
      breakers: [],
      ote: [],
    });
    expect(refs.filter((r) => r.concept === 'ORDER_BLOCK')).toEqual([
      {
        id: 'ob1',
        concept: 'ORDER_BLOCK',
        direction: 'BULLISH',
        formedAt: T0,
        confirmedAt: end(1),
        confirmedIndex: 1,
      },
    ]);
  });
});

describe('summarizeOutcomes', () => {
  const o = (status: CandidateOutcome['status']): CandidateOutcome => ({
    id: status,
    status,
    failedAt: null,
    resolvedAt: null,
  });

  it('measures the failure share among decided candidates only and flags small samples', () => {
    expect(summarizeOutcomes([o('FAILED'), o('HELD'), o('HELD'), o('PENDING')])).toEqual({
      total: 4,
      held: 2,
      failed: 1,
      pending: 1,
      failureRate: 1 / 3,
      lowSample: true,
    });
    expect(summarizeOutcomes([o('PENDING')]).failureRate).toBeNull();
    expect(summarizeOutcomes(Array.from({ length: 30 }, () => o('HELD'))).lowSample).toBe(false);
  });
});
