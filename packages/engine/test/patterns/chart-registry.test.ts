import { describe, expect, it } from 'vitest';
import { detectSwings } from '../../src/features/swing';
import { detectDoubleBottom } from '../../src/patterns/chart';
import {
  CHART_PATTERN_DETECTORS,
  CHART_PATTERN_IDS,
  detectAllChartPatterns,
} from '../../src/patterns/chart-registry';
import { CHART_PIVOT_PARAMS } from '../../src/patterns/chart-shared';
import { pathBars } from '../helpers/synthetic-bars';

// SYNTHETIC: the same double-bottom shape as patterns/chart.test.ts's positive fixture.
const DOUBLE_BOTTOM_BARS = pathBars([
  [0, 1.11],
  [20, 1.095],
  [35, 1.105],
  [50, 1.095],
  [65, 1.11],
]);

describe('CHART_PATTERN_DETECTORS / detectAllChartPatterns (D63)', () => {
  it('has exactly one entry per CHART_PATTERN_IDS entry', () => {
    expect(CHART_PATTERN_IDS.length).toBe(21);
    expect(new Set(CHART_PATTERN_IDS).size).toBe(21);
    expect(Object.keys(CHART_PATTERN_DETECTORS)).toEqual([...CHART_PATTERN_IDS]);
  });

  it('every registered detector tags its output with the id it is registered under', () => {
    const swings = detectSwings(DOUBLE_BOTTOM_BARS, CHART_PIVOT_PARAMS);
    for (const [id, fn] of Object.entries(CHART_PATTERN_DETECTORS)) {
      for (const p of fn(DOUBLE_BOTTOM_BARS, swings)) expect(p.patternId).toBe(id);
    }
  });

  it('detectAllChartPatterns finds the same double_bottom as calling the detector directly', () => {
    const swings = detectSwings(DOUBLE_BOTTOM_BARS, CHART_PIVOT_PARAMS);
    const direct = detectDoubleBottom(DOUBLE_BOTTOM_BARS, swings);
    expect(direct.length).toBeGreaterThan(0);
    const all = detectAllChartPatterns(DOUBLE_BOTTOM_BARS, swings);
    expect(all.filter((p) => p.patternId === 'double_bottom')).toEqual(direct);
  });
});
