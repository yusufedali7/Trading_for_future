import { describe, expect, it } from 'vitest';
import { toBars } from '../src/features/bars';
import type { FeatureSet } from '../src/features/compute';
import type { SmcSet } from '../src/features/smc';
import type {
  Breaker,
  Fvg,
  Ifvg,
  LiquiditySweep,
  OrderBlock,
  OteZone,
  StructureBreak,
} from '../src/features/types';
import type { ChartPattern } from '../src/patterns/types';
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
const emptySmc = (p: Partial<SmcSet>): SmcSet => ({
  displacements: [],
  orderBlocks: [],
  ifvgs: [],
  breakers: [],
  equalLevels: [],
  premiumDiscount: [],
  ote: [],
  candidateSr: [],
  ...p,
});
const orderBlock = (id: string, formed: number, confirmed: number): OrderBlock => ({
  ...timing(id, formed, confirmed),
  type: 'ORDER_BLOCK',
  direction: 'BULLISH',
  top: 1.1003,
  bottom: 1.1001,
  breakId: 'b',
});
const ifvg = (id: string, formed: number, confirmed: number): Ifvg => ({
  ...timing(id, formed, confirmed),
  type: 'IFVG',
  direction: 'BULLISH',
  top: 1.1006,
  bottom: 1.1004,
  sourceFvgId: 'f',
});
const breaker = (id: string, formed: number, confirmed: number): Breaker => ({
  ...timing(id, formed, confirmed),
  type: 'BREAKER',
  direction: 'BULLISH',
  top: 1.1006,
  bottom: 1.1004,
  sourceOrderBlockId: 'ob',
});
const oteZone = (id: string, formed: number, confirmed: number): OteZone => ({
  ...timing(id, formed, confirmed),
  type: 'OTE',
  direction: 'BULLISH',
  top: 1.1006,
  bottom: 1.1004,
  sweetSpot: 1.1005,
  startSwingId: 's1',
  endSwingId: 's2',
});
const chartPattern = (
  id: string,
  patternId: string,
  formed: number,
  confirmed: number,
  extra: Partial<ChartPattern> = {},
): ChartPattern => ({
  ...timing(id, formed, confirmed),
  type: 'PATTERN_EVENT',
  patternId,
  direction: 'BULLISH',
  pivots: [],
  confirmationRef: 1.1,
  targetPrice: 1.105,
  invalidationRef: 1.098,
  ...extra,
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

describe('findSetups with SMC steps (D58)', () => {
  it('chains an order block into an IFVG, reading SmcSet instead of FeatureSet', () => {
    const s: StrategySpec = {
      ...spec,
      steps: [
        { id: 'ob', type: 'ORDER_BLOCK', direction: 'BULLISH' },
        { id: 'ifvg', type: 'IFVG', direction: 'BULLISH', maxBars: 5 },
      ],
    };
    const smc = emptySmc({
      orderBlocks: [orderBlock('ob1', 2, 3)],
      ifvgs: [ifvg('iv1', 6, 7)],
    });
    const [found, ...rest] = findSetups(s, b, set({}), smc);
    expect(rest).toEqual([]);
    expect(found).toMatchObject({
      id: 'SETUP:ob1|iv1',
      refs: { 'ob.top': 1.1003, 'ob.bottom': 1.1001, 'ob.mid': 1.1002, 'ifvg.top': 1.1006 },
    });
  });

  it('matches a breaker and an OTE step, with sweetSpot available as a ref', () => {
    const s: StrategySpec = {
      ...spec,
      steps: [
        { id: 'brk', type: 'BREAKER', direction: 'BULLISH' },
        { id: 'ote', type: 'OTE', direction: 'BULLISH', maxBars: 5 },
      ],
    };
    const smc = emptySmc({
      breakers: [breaker('bk1', 2, 3)],
      ote: [oteZone('ot1', 4, 5)],
    });
    const [found] = findSetups(s, b, set({}), smc);
    expect(found).toMatchObject({ refs: { 'ote.sweetSpot': 1.1005 } });
  });

  it('finds nothing when smc is omitted, even if a step asks for an SMC concept', () => {
    const s: StrategySpec = {
      ...spec,
      steps: [{ id: 'ob', type: 'ORDER_BLOCK', direction: 'BULLISH' }],
    };
    expect(findSetups(s, b, set({}))).toEqual([]);
  });
});

describe('findSetups with a PATTERN_EVENT step (D63)', () => {
  const s: StrategySpec = {
    ...spec,
    steps: [{ id: 'pattern', type: 'PATTERN_EVENT', patternId: 'double_bottom' }],
  };

  it('matches by patternId and exposes confirmationRef/targetPrice/invalidationRef as refs', () => {
    const patterns = [chartPattern('p1', 'double_bottom', 2, 4)];
    const [found, ...rest] = findSetups(s, b, set({}), undefined, patterns);
    expect(rest).toEqual([]);
    expect(found).toMatchObject({
      id: 'SETUP:p1',
      refs: {
        'pattern.confirmationRef': 1.1,
        'pattern.targetPrice': 1.105,
        'pattern.invalidationRef': 1.098,
      },
    });
  });

  it('ignores a different patternId', () => {
    const patterns = [chartPattern('p1', 'rectangle', 2, 4)];
    expect(findSetups(s, b, set({}), undefined, patterns)).toEqual([]);
  });

  it('omits a null targetPrice/invalidationRef from refs instead of fabricating a value', () => {
    const patterns = [
      chartPattern('p1', 'double_bottom', 2, 4, { targetPrice: null, invalidationRef: null }),
    ];
    const [found] = findSetups(s, b, set({}), undefined, patterns);
    expect(found!.refs).toEqual({ 'pattern.confirmationRef': 1.1 });
  });

  it('finds nothing when patterns is omitted, even if a step asks for one', () => {
    expect(findSetups(s, b, set({}))).toEqual([]);
  });

  it('filters by direction when the step asks for one', () => {
    const sBearish: StrategySpec = {
      ...spec,
      steps: [
        { id: 'pattern', type: 'PATTERN_EVENT', patternId: 'double_bottom', direction: 'BEARISH' },
      ],
    };
    const patterns = [chartPattern('p1', 'double_bottom', 2, 4)]; // BULLISH
    expect(findSetups(sBearish, b, set({}), undefined, patterns)).toEqual([]);
  });
});

describe('findSetups with EMA_PULLBACK / DONCHIAN_BREAK steps (D65)', () => {
  it('EMA_PULLBACK: fires when the bar dips to the EMA and closes back above it, bullish', () => {
    // SYNTHETIC: ema(bars, 2) seeds at 1.0 from bars 0-1, then bar 2 (low 0.99, close 1.05,
    // open 1.0) dips under the level and closes back above it with a bullish body.
    const b3 = bars([
      [1.0, 1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0, 1.0],
      [1.0, 1.06, 0.99, 1.05],
    ]);
    const s: StrategySpec = {
      ...spec,
      steps: [{ id: 'pullback', type: 'EMA_PULLBACK', period: 2, direction: 'BULLISH' }],
    };
    const [found, ...rest] = findSetups(s, b3, set({}));
    expect(rest).toEqual([]);
    expect(found).toMatchObject({ id: 'SETUP:EMA_PULLBACK:2:2', signalIndex: 2 });
    expect(found!.refs['pullback.level']).toBeCloseTo(1.033333, 5);
  });

  it('EMA_PULLBACK: a direction filter excludes the opposite-signed bar', () => {
    const b3 = bars([
      [1.0, 1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0, 1.0],
      [1.0, 1.06, 0.99, 1.05], // bullish pullback bar
    ]);
    const s: StrategySpec = {
      ...spec,
      steps: [{ id: 'pullback', type: 'EMA_PULLBACK', period: 2, direction: 'BEARISH' }],
    };
    expect(findSetups(s, b3, set({}))).toEqual([]);
  });

  it("DONCHIAN_BREAK: fires when the close breaks the prior period's high (lagged, no lookahead)", () => {
    // SYNTHETIC: highs 1.00/1.02/1.01 over bars 0-2 -> prior rolling high at bar 3 is 1.02;
    // bar 3 closes at 1.05, above it.
    const b4 = bars([
      [1.0, 1.0, 0.99, 1.0],
      [1.0, 1.02, 0.99, 1.0],
      [1.0, 1.01, 0.99, 1.0],
      [1.0, 1.1, 1.0, 1.05],
    ]);
    const s: StrategySpec = {
      ...spec,
      steps: [{ id: 'breakout', type: 'DONCHIAN_BREAK', period: 3, direction: 'BULLISH' }],
    };
    const [found, ...rest] = findSetups(s, b4, set({}));
    expect(rest).toEqual([]);
    expect(found).toMatchObject({ signalIndex: 3, refs: { 'breakout.level': 1.02 } });
  });

  it('DONCHIAN_BREAK: does not fire on the bar that sets the high itself (no lookahead)', () => {
    // A single rising series never closes above its OWN prior window within the window itself.
    const b4 = bars([
      [1.0, 1.0, 0.99, 1.0],
      [1.0, 1.02, 0.99, 1.0],
      [1.0, 1.01, 0.99, 1.0],
    ]);
    const s: StrategySpec = {
      ...spec,
      steps: [{ id: 'breakout', type: 'DONCHIAN_BREAK', period: 3, direction: 'BULLISH' }],
    };
    expect(findSetups(s, b4, set({}))).toEqual([]);
  });
});

describe('findSetups with a trendFilter (D65)', () => {
  const f = set({
    sweeps: [sweep('sw1', 2)],
    breaks: [brk('b1', 5), brk('b2', 6)],
    fvgs: [fvg('f1', 6)], // confirmed at 7, same chain as the first describe block's test
  });

  it('keeps an otherwise-valid setup when the trend condition holds at the signal bar', () => {
    // SYNTHETIC: 7 flat bars at 1.1, then a jump to 1.3 from bar 7 on - close and the fast EMA
    // both end up above the slower EMA at the signal bar (7).
    const bJump = bars([
      ...Array.from({ length: 7 }, () => [1.1, 1.1005, 1.0995, 1.1] as const),
      ...Array.from({ length: 13 }, () => [1.3, 1.3005, 1.2995, 1.3] as const),
    ]);
    const s: StrategySpec = { ...spec, trendFilter: { fast: 2, slow: 5 } };
    expect(findSetups(s, bJump, f).map((x) => x.signalIndex)).toEqual([7]);
  });

  it('removes an otherwise-valid setup when the trend condition fails at the signal bar', () => {
    // The base fixture's bars are flat throughout, so fast EMA === slow EMA === close at every
    // bar - "strictly above" never holds, so a LONG trend filter rejects every bar.
    const s: StrategySpec = { ...spec, trendFilter: { fast: 2, slow: 5 } };
    expect(findSetups(s, b, f)).toEqual([]);
  });

  it('rejects a bar where the slow EMA has not warmed up yet, instead of fabricating a value', () => {
    // Only 3 bars exist; ema(b, 5) needs 5 to produce anything, so it's null everywhere - the
    // filter must not treat "unknown" as "passes" (rule 1: no data, no result).
    const shortB = bars([
      [1.0, 1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0, 1.0],
      [1.0, 1.06, 0.99, 1.05],
    ]);
    const s: StrategySpec = {
      ...spec,
      steps: [{ id: 'pullback', type: 'EMA_PULLBACK', period: 2, direction: 'BULLISH' }],
      trendFilter: { fast: 2, slow: 5 },
    };
    expect(findSetups(s, shortB, set({}))).toEqual([]);
  });
});
