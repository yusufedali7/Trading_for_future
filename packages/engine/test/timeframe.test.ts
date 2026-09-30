import { describe, expect, it } from 'vitest';
import { TIMEFRAMES, compareTimeframes, isTimeframe, timeframeMs } from '../src/core/timeframe';

describe('timeframes', () => {
  it('lists supported timeframes from smallest to largest', () => {
    expect(TIMEFRAMES).toEqual(['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W']);
  });

  it.each([
    ['1m', 60_000],
    ['5m', 300_000],
    ['15m', 900_000],
    ['30m', 1_800_000],
    ['1h', 3_600_000],
    ['4h', 14_400_000],
    ['1D', 86_400_000],
    ['1W', 604_800_000],
  ] as const)('%s nominally lasts %d ms', (tf, ms) => {
    expect(timeframeMs(tf)).toBe(ms);
  });

  it('recognises valid timeframe strings only', () => {
    expect(isTimeframe('15m')).toBe(true);
    expect(isTimeframe('1d')).toBe(false);
    expect(isTimeframe('2h')).toBe(false);
  });

  it('orders timeframes by size', () => {
    expect(compareTimeframes('1m', '4h')).toBeLessThan(0);
    expect(compareTimeframes('1W', '1D')).toBeGreaterThan(0);
    expect(compareTimeframes('1h', '1h')).toBe(0);
  });
});
