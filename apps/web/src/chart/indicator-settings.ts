import {
  atr as atrOf,
  bollinger as bollingerOf,
  ema as emaOf,
  macd as macdOf,
  rsi as rsiOf,
  sma as smaOf,
  toBars,
  vwap as vwapOf,
  type Bars,
  type Instrument,
  type ResampledCandle,
  type Timeframe,
} from '@trw/engine';

export type Oscillator = 'NONE' | 'RSI' | 'MACD';

/** Chart overlays (stored in prefs); ATR is not drawn, it is used for sizing elsewhere. */
export interface IndicatorSettings {
  sma: { on: boolean; period: number };
  ema: { on: boolean; period: number };
  bollinger: { on: boolean; period: number; k: number };
  vwap: { on: boolean };
  oscillator: Oscillator;
  rsi: { period: number };
  macd: { fast: number; slow: number; signal: number };
}

export const DEFAULT_INDICATORS: IndicatorSettings = {
  sma: { on: false, period: 20 },
  ema: { on: false, period: 20 },
  bollinger: { on: false, period: 20, k: 2 },
  vwap: { on: false },
  oscillator: 'NONE',
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
};

export function activeIndicatorCount(s: IndicatorSettings): number {
  return (
    (s.sma.on ? 1 : 0) +
    (s.ema.on ? 1 : 0) +
    (s.bollinger.on ? 1 : 0) +
    (s.vwap.on ? 1 : 0) +
    (s.oscillator === 'NONE' ? 0 : 1)
  );
}

export interface ComputedIndicators {
  sma: (number | null)[] | null;
  ema: (number | null)[] | null;
  bollinger: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  } | null;
  vwap: (number | null)[] | null;
  rsi: (number | null)[] | null;
  macd: { line: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } | null;
}

/** Only on the base series, not derived from the resampled display candles (consistent with M4). */
export function computeIndicators(
  candles: readonly ResampledCandle[],
  inst: Instrument,
  tf: Timeframe,
  s: IndicatorSettings,
): ComputedIndicators {
  const b: Bars = toBars(candles, inst, tf);
  return {
    sma: s.sma.on ? smaOf(b, s.sma.period) : null,
    ema: s.ema.on ? emaOf(b, s.ema.period) : null,
    bollinger: s.bollinger.on ? bollingerOf(b, s.bollinger.period, s.bollinger.k) : null,
    vwap: s.vwap.on ? vwapOf(b) : null,
    rsi: s.oscillator === 'RSI' ? rsiOf(b, s.rsi.period) : null,
    macd: s.oscillator === 'MACD' ? macdOf(b, s.macd.fast, s.macd.slow, s.macd.signal) : null,
  };
}

/** ATR for position sizing hints (not drawn); exposed so callers do not call toBars twice. */
export function computeAtr(
  candles: readonly ResampledCandle[],
  inst: Instrument,
  tf: Timeframe,
  period = 14,
): (number | null)[] {
  return atrOf(toBars(candles, inst, tf), period);
}

/** Candle-time/value pairs for a line series; null (warm-up) points are dropped, not zeroed. */
export function toLinePoints(
  candles: readonly ResampledCandle[],
  values: readonly (number | null)[],
): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  for (let i = 0; i < candles.length && i < values.length; i++) {
    const v = values[i]!;
    if (v !== null) out.push({ time: candles[i]!.t, value: v });
  }
  return out;
}
