import { describe, expect, it } from 'vitest';
import { CATALOG_STRATEGIES } from '../src/catalog/strategies';
import { toBars } from '../src/features/bars';
import type { FeatureSet } from '../src/features/compute';
import { computeFeatures } from '../src/features/compute';
import { computeSmc } from '../src/features/smc';
import { detectSwings } from '../src/features/swing';
import { detectAllChartPatterns } from '../src/patterns/chart-registry';
import { CHART_PIVOT_PARAMS } from '../src/patterns/chart-shared';
import { allSessionDefs } from '../src/session/sessions';
import { sessionLevels } from '../src/session/levels';
import { sessionInstances } from '../src/session/sessions';
import { findSetups } from '../src/strategy/matcher';
import { validateSpec } from '../src/strategy/schema';
import { EUR, MIN, syntheticMinutes } from './helpers/synthetic-minutes';
import { seriesFromRows } from '../src/data/columnar';
import { resample } from '../src/data/resample';
import { bars, pathBars } from './helpers/synthetic-bars';

const EMPTY_FEATURES: FeatureSet = { swings: [], fvgs: [], breaks: [], sweeps: [], periods: [] };

/** SYNTHETIC: a steady uptrend with one deep-wick bullish-reversal bar inserted at `pullbackAt`. */
function risingBarsWithPullback(n: number, pullbackAt: number) {
  const rows: [number, number, number, number][] = [];
  let prevClose = 1.0;
  for (let i = 0; i < n; i++) {
    const close = 1.0 + (0.3 * i) / (n - 1);
    if (i === pullbackAt) rows.push([prevClose, close + 0.001, close - 0.05, close]);
    else
      rows.push([
        prevClose,
        Math.max(prevClose, close) + 0.0001,
        Math.min(prevClose, close) - 0.0001,
        close,
      ]);
    prevClose = close;
  }
  return bars(rows);
}

/** SYNTHETIC: a tight range, then one bar that clearly breaks above it at `breakoutAt`. */
function rangeThenBreakout(n: number, breakoutAt: number) {
  const rows: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++)
    rows.push(i === breakoutAt ? [1.1, 1.2, 1.09, 1.18] : [1.1, 1.105, 1.095, 1.1]);
  return bars(rows);
}

describe('CATALOG_STRATEGIES (D61)', () => {
  it('both london_asia_sweep versions are valid specs', () => {
    const specs = CATALOG_STRATEGIES.filter((c) => c.catalogId === 'london_asia_sweep');
    expect(specs).toHaveLength(2);
    expect(specs.map((c) => c.versionLabel)).toEqual(['fvg', 'order_block']);
    for (const c of specs) expect(validateSpec(c.spec)).toEqual([]);
  });

  it('both versions chain real sweep/break/FVG/order-block candidates end to end', () => {
    // The real spec's London 08-11 window + Asia-sweep requirement is rare by design (the
    // project's own real-data run found only 3 matches over ~14 months, D34) - too rare to
    // assert ">0" on a short synthetic walk without flaking. This drops the window and widens
    // maxBars to prove the chain itself works (SMC steps included), not to approximate frequency.
    const rows = syntheticMinutes('2026-01-05T00:00:00Z', '2026-04-05T00:00:00Z', 23, 6);
    const series = seriesFromRows(rows, false);
    const asOf = series.t[series.length - 1]! + MIN;
    const candles = resample(series, EUR, '15m', { asOf });
    const defs = allSessionDefs([]);
    const instances = defs.flatMap((def) => sessionInstances(def, EUR, series.t[0]!, asOf));
    const sessions = sessionLevels(series, instances, asOf, MIN);
    const b = toBars(candles, EUR, '15m');

    for (const c of CATALOG_STRATEGIES.filter((c) => c.catalogId === 'london_asia_sweep')) {
      const features = computeFeatures(
        { candles, inst: EUR, tf: '15m', periods: [], sessions, sessionDefs: defs },
        c.spec.features,
      );
      const smc = computeSmc(b, EUR);
      const relaxed = {
        ...c.spec,
        window: null,
        steps: c.spec.steps.map((s) => (s.id === 'sweep' ? s : { ...s, maxBars: 200 })),
      };
      const setups = findSetups(relaxed, b, features, smc);
      expect(setups.length).toBeGreaterThan(0);
    }
  });
});

describe('CATALOG_STRATEGIES: double_bottom_confirmed (D63)', () => {
  it('both versions are valid specs', () => {
    const specs = CATALOG_STRATEGIES.filter((c) => c.catalogId === 'double_bottom_confirmed');
    expect(specs).toHaveLength(2);
    expect(specs.map((c) => c.versionLabel)).toEqual(['measured_move', 'fixed_2r']);
    for (const c of specs) expect(validateSpec(c.spec)).toEqual([]);
  });

  it('both versions chain a real double_bottom candidate end to end', () => {
    // SYNTHETIC: the same double-bottom shape used in patterns/chart.test.ts's positive fixture.
    const b = pathBars([
      [0, 1.11],
      [20, 1.095],
      [35, 1.105],
      [50, 1.095],
      [65, 1.11],
    ]);
    const patterns = detectAllChartPatterns(b, detectSwings(b, CHART_PIVOT_PARAMS));
    expect(patterns.some((p) => p.patternId === 'double_bottom')).toBe(true);
    for (const c of CATALOG_STRATEGIES.filter((c) => c.catalogId === 'double_bottom_confirmed')) {
      const setups = findSetups(c.spec, b, EMPTY_FEATURES, undefined, patterns);
      expect(setups.length).toBeGreaterThan(0);
    }
  });
});

describe('CATALOG_STRATEGIES: d1_trend_pullback (D65)', () => {
  it('both versions are valid specs', () => {
    const specs = CATALOG_STRATEGIES.filter((c) => c.catalogId === 'd1_trend_pullback');
    expect(specs).toHaveLength(2);
    expect(specs.map((c) => c.versionLabel)).toEqual(['long', 'short']);
    for (const c of specs) expect(validateSpec(c.spec)).toEqual([]);
  });

  it('the long version chains a real EMA pullback in an established uptrend', () => {
    const long = CATALOG_STRATEGIES.find(
      (c) => c.catalogId === 'd1_trend_pullback' && c.versionLabel === 'long',
    )!;
    const b = risingBarsWithPullback(220, 210);
    const setups = findSetups(long.spec, b, EMPTY_FEATURES);
    expect(setups.length).toBeGreaterThan(0);
  });

  it('the long version finds nothing on a flat series (no pullback, no trend)', () => {
    const flat = bars(Array.from({ length: 220 }, () => [1.1, 1.1001, 1.0999, 1.1] as const));
    const long = CATALOG_STRATEGIES.find(
      (c) => c.catalogId === 'd1_trend_pullback' && c.versionLabel === 'long',
    )!;
    expect(findSetups(long.spec, flat, EMPTY_FEATURES)).toEqual([]);
  });
});

describe('CATALOG_STRATEGIES: donchian_breakout_d1 (D65)', () => {
  it('both versions are valid specs', () => {
    const specs = CATALOG_STRATEGIES.filter((c) => c.catalogId === 'donchian_breakout_d1');
    expect(specs).toHaveLength(2);
    expect(specs.map((c) => c.versionLabel)).toEqual(['long', 'short']);
    for (const c of specs) expect(validateSpec(c.spec)).toEqual([]);
  });

  it('the long version chains a real Donchian breakout', () => {
    const long = CATALOG_STRATEGIES.find(
      (c) => c.catalogId === 'donchian_breakout_d1' && c.versionLabel === 'long',
    )!;
    const b = rangeThenBreakout(30, 25);
    const setups = findSetups(long.spec, b, EMPTY_FEATURES);
    expect(setups.length).toBeGreaterThan(0);
  });

  it('the long version finds nothing while price stays inside the range', () => {
    const b = rangeThenBreakout(30, -1); // no breakout bar
    const long = CATALOG_STRATEGIES.find(
      (c) => c.catalogId === 'donchian_breakout_d1' && c.versionLabel === 'long',
    )!;
    expect(findSetups(long.spec, b, EMPTY_FEATURES)).toEqual([]);
  });
});
