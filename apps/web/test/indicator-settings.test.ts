import { describe, expect, it } from 'vitest';
import { getInstrument, type ResampledCandle } from '@trw/engine';
import {
  computeIndicators,
  DEFAULT_INDICATORS,
  toLinePoints,
} from '../src/chart/indicator-settings';

const EUR = getInstrument('EURUSD');

// SYNTHETIC: 30 one-minute bars, closes rising by 0.0001 each bar.
const candles: ResampledCandle[] = Array.from({ length: 30 }, (_, i) => ({
  t: Date.parse('2026-01-06T10:00:00Z') + i * 60_000,
  o: 1.1 + i * 0.0001,
  h: 1.1 + i * 0.0001 + 0.00005,
  l: 1.1 + i * 0.0001 - 0.00005,
  c: 1.1 + i * 0.0001,
  complete: true,
  sourceCount: 1,
  expectedCount: 1,
}));

describe('computeIndicators', () => {
  it('only computes what is switched on', () => {
    const r = computeIndicators(candles, EUR, '1m', DEFAULT_INDICATORS);
    expect(r).toEqual({ sma: null, ema: null, bollinger: null, vwap: null, rsi: null, macd: null });

    const r2 = computeIndicators(candles, EUR, '1m', {
      ...DEFAULT_INDICATORS,
      sma: { on: true, period: 5 },
      oscillator: 'RSI',
    });
    expect(r2.sma).not.toBeNull();
    expect(r2.sma![4]).toBeCloseTo(1.1002);
    expect(r2.rsi).not.toBeNull();
    expect(r2.rsi![r2.rsi!.length - 1]).toBe(100); // unbroken rise
    expect(r2.macd).toBeNull();
  });
});

describe('toLinePoints', () => {
  it('drops warm-up nulls and keeps candle times', () => {
    const values = [null, null, 1, 2, null, 3];
    const short = candles.slice(0, values.length);
    expect(toLinePoints(short, values)).toEqual([
      { time: short[2]!.t, value: 1 },
      { time: short[3]!.t, value: 2 },
      { time: short[5]!.t, value: 3 },
    ]);
  });
});
