import { describe, expect, it } from 'vitest';
import { toBars } from '../src/features/bars';
import type { FeatureSet } from '../src/features/compute';
import type { Fvg, LiquiditySweep, StructureBreak } from '../src/features/types';
import { findSetups, inWindow } from '../src/strategy/matcher';
import { defaultSpec, type StrategySpec } from '../src/strategy/schema';
import { BAR_MS, T0, bars } from './helpers/synthetic-bars';
import { EUR, syntheticDataset } from './helpers/synthetic-minutes';

// SYNTHETIC: 20 flat 15m bars; detections are hand-written so only the matching logic is tested.
const b = bars(Array.from({ length: 20 }, () => [1.1, 1.1005, 1.0995, 1.1] as const));
const at = (i: number) => T0 + i * BAR_MS;
const timing = (id: string, formed: number, confirmed: number) => ({
  id,
  defVersion: 'v1' as const,
  formedAt: at(formed),
  formedIndex: formed,
  confirmedAt: at(confirmed + 1),
  confirmedIndex: confirmed,
});
const sweep = (id: string, i: number, extra: Partial<LiquiditySweep> = {}): LiquiditySweep => ({
  ...timing(id, i, i),
  type: 'LIQUIDITY_SWEEP',
  direction: 'BULLISH',
  levelId: 'L',
  levelKind: 'ASIA_LOW',
  level: 1.099,
  extreme: 1.0985,
  ...extra,
});
const brk = (id: string, i: number, extra: Partial<StructureBreak> = {}): StructureBreak => ({
  ...timing(id, i, i),
  type: 'STRUCTURE_BREAK',
  direction: 'BULLISH',
  kind: 'CHOCH',
  level: 1.1004,
  swingId: 's',
  swingAt: at(0),
  ...extra,
});
const fvg = (id: string, formed: number): Fvg => ({
  ...timing(id, formed, formed + 1),
  type: 'FVG',
  direction: 'BULLISH',
  top: 1.1003,
  bottom: 1.1001,
  touchedAt: null,
  filledAt: null,
});
const set = (p: Partial<FeatureSet>): FeatureSet => ({
  swings: [],
  fvgs: [],
  breaks: [],
  sweeps: [],
  periods: [],
  ...p,
});

const spec: StrategySpec = {
  ...defaultSpec(),
  steps: [
    { id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH', levels: ['ASIA_LOW'] },
    { id: 'mss', type: 'STRUCTURE_BREAK', direction: 'BULLISH', maxBars: 4 },
    { id: 'fvg', type: 'FVG', direction: 'BULLISH', maxBars: 3 },
  ],
};

describe('findSetups (v1)', () => {
  it('chains the earliest matching candidates and exposes their reference values', () => {
    const f = set({
      sweeps: [sweep('sw1', 2)],
      breaks: [brk('b1', 5), brk('b2', 6)],
      fvgs: [fvg('f1', 6)], // confirmed at 7
    });
    const [s, ...rest] = findSetups(spec, b, f);
    expect(rest).toEqual([]);
    expect(s).toMatchObject({
      id: 'SETUP:sw1|b1|f1',
      signalIndex: 7,
      signalBarAt: at(7),
      signalAt: at(8),
      refs: {
        'sweep.level': 1.099,
        'sweep.extreme': 1.0985,
        'mss.level': 1.1004,
        'fvg.top': 1.1003,
        'fvg.bottom': 1.1001,
        'fvg.mid': 1.1002,
      },
    });
    expect(s!.steps.map((x) => x.detectionId)).toEqual(['sw1', 'b1', 'f1']);
  });

  it('respects filters and the bar windows between steps', () => {
    const f = set({
      sweeps: [sweep('wrong-level', 1, { levelKind: 'PDL' }), sweep('sw', 2)],
      breaks: [brk('bear', 3, { direction: 'BEARISH' }), brk('late', 7)], // 7 − 2 = 5 > 4 bars
      fvgs: [fvg('f', 8)],
    });
    expect(findSetups(spec, b, f)).toEqual([]);
    const ok = set({ ...f, breaks: [brk('in-time', 6)] }); // 6 − 2 = 4 ≤ 4
    expect(findSetups(spec, b, ok).map((s) => s.signalIndex)).toEqual([9]);
  });

  it('allows a later step on the same bar, and two first-step candidates give one setup', () => {
    const f = set({
      sweeps: [sweep('a', 3), sweep('b', 4)],
      breaks: [brk('m', 4)],
      fvgs: [fvg('g', 4)],
    });
    expect(findSetups(spec, b, f).map((s) => s.id)).toEqual(['SETUP:a|m|g']);
  });

  it('only keeps setups whose signal bar starts inside the time window', () => {
    // T0 = 08:00Z = 08:00 London (winter); signal bar 7 opens 09:45.
    const f = set({ sweeps: [sweep('sw', 2)], breaks: [brk('m', 5)], fvgs: [fvg('g', 6)] });
    const w = (start: string, end: string) => ({
      ...spec,
      window: { start, end, tz: 'Europe/London' },
    });
    expect(findSetups(w('08:00', '10:00') as StrategySpec, b, f)).toHaveLength(1);
    expect(findSetups(w('08:00', '09:45') as StrategySpec, b, f)).toHaveLength(0);
    expect(
      inWindow({ start: '22:00', end: '02:00', tz: 'UTC' }, Date.parse('2026-01-06T01:00:00Z')),
    ).toBe(true);
    expect(
      inWindow({ start: '22:00', end: '02:00', tz: 'UTC' }, Date.parse('2026-01-06T12:00:00Z')),
    ).toBe(false);
  });

  it('is truncation invariant on generated data', () => {
    const ds = syntheticDataset('2026-01-04T22:00:00Z', '2026-01-09T22:00:00Z', 99);
    const s: StrategySpec = {
      ...spec,
      steps: [
        { id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH' },
        { id: 'mss', type: 'STRUCTURE_BREAK', direction: 'BULLISH', maxBars: 12 },
      ],
    };
    const full = ds.at(ds.end, '5m');
    const all = findSetups(s, toBars(full.candles, EUR, '5m'), full.features);
    expect(all.length).toBeGreaterThan(5);
    for (let j = 0; j < 15; j++) {
      const cutoff = ds.rows[400 + j * 397]!.t + 60_000;
      const cut = ds.at(cutoff, '5m');
      expect(findSetups(s, toBars(cut.candles, EUR, '5m'), cut.features)).toEqual(
        all.filter((x) => x.signalAt <= cutoff),
      );
    }
  });
});
