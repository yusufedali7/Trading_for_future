import { describe, expect, it } from 'vitest';
import { detectDoji } from '../../src/patterns/candlestick';
import {
  CANDLE_PATTERN_DETECTORS,
  CANDLE_PATTERN_IDS,
  candlePatternsAsOf,
  detectAllCandlePatterns,
} from '../../src/patterns/candle-registry';
import { bars } from '../helpers/synthetic-bars';

// SYNTHETIC: same fixture as patterns/candlestick.test.ts's detectDoji positive case.
const DOJI_BARS = bars([
  [1.1, 1.1005, 1.0998, 1.1004],
  [1.1004, 1.1009, 1.0999, 1.1003],
  [1.1003, 1.1008, 1.0998, 1.1002],
  [1.1002, 1.1007, 1.0997, 1.1001],
  [1.1001, 1.1006, 1.0996, 1.1],
  [1.1, 1.1005, 1.0995, 1.1004],
  [1.1004, 1.1009, 1.0999, 1.1003],
  [1.1003, 1.1008, 1.0998, 1.1002],
  [1.1002, 1.1007, 1.0997, 1.1006],
  [1.1006, 1.1011, 1.0998, 1.1001],
  [1.1001, 1.1061, 1.0941, 1.10012],
]);

describe('CANDLE_PATTERN_DETECTORS / detectAllCandlePatterns (D67)', () => {
  it('has exactly one entry per CANDLE_PATTERN_IDS entry', () => {
    expect(CANDLE_PATTERN_IDS.length).toBe(61);
    expect(new Set(CANDLE_PATTERN_IDS).size).toBe(61);
    expect(Object.keys(CANDLE_PATTERN_DETECTORS)).toEqual([...CANDLE_PATTERN_IDS]);
  });

  it('every registered detector tags its output with the id it is registered under', () => {
    for (const [id, fn] of Object.entries(CANDLE_PATTERN_DETECTORS)) {
      for (const p of fn(DOJI_BARS)) expect(p.patternId).toBe(id);
    }
  });

  it('detectAllCandlePatterns finds the same cdldoji match as calling the detector directly', () => {
    const direct = detectDoji(DOJI_BARS);
    expect(direct.length).toBeGreaterThan(0);
    const all = detectAllCandlePatterns(DOJI_BARS);
    expect(all.filter((p) => p.patternId === 'cdldoji')).toEqual(direct);
  });
});

describe('candlePatternsAsOf (D85)', () => {
  it('keeps only patterns confirmed at or before the cutoff', () => {
    const found = detectDoji(DOJI_BARS);
    expect(found.length).toBeGreaterThan(0);
    const confirmedAt = found[0]!.confirmedAt;

    expect(candlePatternsAsOf(found, confirmedAt - 1)).toEqual([]);
    expect(candlePatternsAsOf(found, confirmedAt)).toEqual(found);
  });
});
