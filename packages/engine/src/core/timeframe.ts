export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

const MINUTE = 60_000;

const DURATION_MS: Record<Timeframe, number> = {
  '1m': MINUTE,
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '30m': 30 * MINUTE,
  '1h': 60 * MINUTE,
  '4h': 240 * MINUTE,
  '1D': 1440 * MINUTE,
  '1W': 7 * 1440 * MINUTE,
};

/**
 * Nominal duration. Exact for intraday frames; 1D/1W boundaries follow the instrument's
 * daily close in its own time zone, so a real day can be 23h or 25h across DST.
 */
export function timeframeMs(tf: Timeframe): number {
  return DURATION_MS[tf];
}

export function isTimeframe(value: string): value is Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(value);
}

export function compareTimeframes(a: Timeframe, b: Timeframe): number {
  return TIMEFRAMES.indexOf(a) - TIMEFRAMES.indexOf(b);
}
