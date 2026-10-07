import type { Bars } from '../features/bars';

/**
 * TA-Lib's own candle classification thresholds (BSD licence), sourced from the official
 * default settings table: https://ta-lib.org/api/candle-settings/ (checked 2026-10-07).
 * Each setting compares a bar's own measurement against `factor × average(rangeType, avgPeriod)`
 * over the `avgPeriod` bars *before* it (never including the bar itself: rule 3, no lookahead).
 */
export const CANDLE_SETTINGS = {
  bodyLong: { range: 'REAL_BODY', avgPeriod: 10, factor: 1.0 },
  bodyVeryLong: { range: 'REAL_BODY', avgPeriod: 10, factor: 3.0 },
  bodyShort: { range: 'REAL_BODY', avgPeriod: 10, factor: 1.0 },
  bodyDoji: { range: 'HIGH_LOW', avgPeriod: 10, factor: 0.1 },
  shadowVeryShort: { range: 'HIGH_LOW', avgPeriod: 10, factor: 0.1 },
} as const;

export const realBody = (b: Bars, i: number): number => Math.abs(b.c[i]! - b.o[i]!);
export const highLowRange = (b: Bars, i: number): number => b.h[i]! - b.l[i]!;
export const upperShadow = (b: Bars, i: number): number => b.h[i]! - Math.max(b.o[i]!, b.c[i]!);
export const lowerShadow = (b: Bars, i: number): number => Math.min(b.o[i]!, b.c[i]!) - b.l[i]!;
export const isBullish = (b: Bars, i: number): boolean => b.c[i]! > b.o[i]!;

/** Average of `measure` over the `avgPeriod` bars strictly before `i`; null if they don't exist. */
function trailingAverage(
  b: Bars,
  i: number,
  avgPeriod: number,
  measure: (b: Bars, j: number) => number,
): number | null {
  if (i < avgPeriod) return null;
  let sum = 0;
  for (let j = i - avgPeriod; j < i; j++) sum += measure(b, j);
  return sum / avgPeriod;
}

type SettingKey = keyof typeof CANDLE_SETTINGS;

/** `measurement(i) < factor × trailing average`, or null while there is not enough history. */
export function below(b: Bars, i: number, setting: SettingKey, value: number): boolean | null {
  const s = CANDLE_SETTINGS[setting];
  const measure = s.range === 'REAL_BODY' ? realBody : highLowRange;
  const avg = trailingAverage(b, i, s.avgPeriod, measure);
  return avg === null ? null : value < s.factor * avg;
}

/** `measurement(i) > factor × trailing average`, or null while there is not enough history. */
export function above(b: Bars, i: number, setting: SettingKey, value: number): boolean | null {
  const s = CANDLE_SETTINGS[setting];
  const measure = s.range === 'REAL_BODY' ? realBody : highLowRange;
  const avg = trailingAverage(b, i, s.avgPeriod, measure);
  return avg === null ? null : value > s.factor * avg;
}
