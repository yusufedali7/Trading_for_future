import type { Bars } from '../features/bars';

/**
 * TA-Lib's own candle classification thresholds (BSD licence), verified against the official
 * source (github.com/TA-Lib/ta-lib, checked 2026-10-08): defaults from
 * `src/ta_common/ta_global.c`, formula from the `TA_CANDLEAVERAGE` macro in
 * `src/ta_func/ta_utility.h`. A setting's "average" is `factor × avg(rangeType, avgPeriod)`,
 * divided by 2 again when rangeType is `SHADOWS` (that average is of upper+lower shadow
 * *combined*, so this yields a single-shadow-sized figure); when `avgPeriod` is 0 there is no
 * trailing history at all - "average" is just the bar's own measurement, so e.g. `shadowLong`
 * compares a shadow to that same bar's own real body (never null, no warm-up). Otherwise the
 * average is over the `avgPeriod` bars *before* the bar being measured (never including it:
 * rule 3, no lookahead).
 */
export type RangeType = 'REAL_BODY' | 'HIGH_LOW' | 'SHADOWS';

export const CANDLE_SETTINGS = {
  bodyLong: { range: 'REAL_BODY', avgPeriod: 10, factor: 1.0 },
  bodyVeryLong: { range: 'REAL_BODY', avgPeriod: 10, factor: 3.0 },
  bodyShort: { range: 'REAL_BODY', avgPeriod: 10, factor: 1.0 },
  bodyDoji: { range: 'HIGH_LOW', avgPeriod: 10, factor: 0.1 },
  shadowLong: { range: 'REAL_BODY', avgPeriod: 0, factor: 1.0 },
  shadowVeryLong: { range: 'REAL_BODY', avgPeriod: 0, factor: 2.0 },
  shadowShort: { range: 'SHADOWS', avgPeriod: 10, factor: 1.0 },
  shadowVeryShort: { range: 'HIGH_LOW', avgPeriod: 10, factor: 0.1 },
  near: { range: 'HIGH_LOW', avgPeriod: 5, factor: 0.2 },
  far: { range: 'HIGH_LOW', avgPeriod: 5, factor: 0.6 },
  equal: { range: 'HIGH_LOW', avgPeriod: 5, factor: 0.05 },
} as const satisfies Record<string, { range: RangeType; avgPeriod: number; factor: number }>;

export const realBody = (b: Bars, i: number): number => Math.abs(b.c[i]! - b.o[i]!);
export const highLowRange = (b: Bars, i: number): number => b.h[i]! - b.l[i]!;
export const upperShadow = (b: Bars, i: number): number => b.h[i]! - Math.max(b.o[i]!, b.c[i]!);
export const lowerShadow = (b: Bars, i: number): number => Math.min(b.o[i]!, b.c[i]!) - b.l[i]!;
export const shadows = (b: Bars, i: number): number => upperShadow(b, i) + lowerShadow(b, i);
export const isBullish = (b: Bars, i: number): boolean => b.c[i]! > b.o[i]!;
/** TA-Lib's own colour rule (`TA_CANDLECOLOR`): a flat candle (close === open) counts as white. */
export const color = (b: Bars, i: number): 1 | -1 => (b.c[i]! >= b.o[i]! ? 1 : -1);

const measureOf: Record<RangeType, (b: Bars, i: number) => number> = {
  REAL_BODY: realBody,
  HIGH_LOW: highLowRange,
  SHADOWS: shadows,
};

/** `avgPeriod` 0: the bar's own measurement. Otherwise its average strictly before `i`, or null. */
function rawAverage(
  b: Bars,
  i: number,
  avgPeriod: number,
  measure: (b: Bars, j: number) => number,
): number | null {
  if (avgPeriod === 0) return measure(b, i);
  if (i < avgPeriod) return null;
  let sum = 0;
  for (let j = i - avgPeriod; j < i; j++) sum += measure(b, j);
  return sum / avgPeriod;
}

export type SettingKey = keyof typeof CANDLE_SETTINGS;

/** A setting's threshold at bar `i` (see the module doc for the exact formula), or null. */
export function candleAverage(b: Bars, i: number, setting: SettingKey): number | null {
  const s = CANDLE_SETTINGS[setting];
  const raw = rawAverage(b, i, s.avgPeriod, measureOf[s.range]);
  if (raw === null) return null;
  return (s.factor * raw) / (s.range === 'SHADOWS' ? 2 : 1);
}

/** `value < setting's threshold at i`, or null while there is not enough history. */
export function below(b: Bars, i: number, setting: SettingKey, value: number): boolean | null {
  const avg = candleAverage(b, i, setting);
  return avg === null ? null : value < avg;
}

/** `value > setting's threshold at i`, or null while there is not enough history. */
export function above(b: Bars, i: number, setting: SettingKey, value: number): boolean | null {
  const avg = candleAverage(b, i, setting);
  return avg === null ? null : value > avg;
}

/**
 * `value <= setting's threshold at i`, or null while there is not enough history. TA-Lib's own
 * source mixes `<`/`<=` per pattern, not per setting (e.g. bodyShort is `<` for a single short
 * candle like Spinning Top but `<=` for the second/short candle of Harami) - each pattern in
 * candlestick.ts uses whichever this project verified against the real-data oracle cross-check.
 */
export function belowOrEqual(
  b: Bars,
  i: number,
  setting: SettingKey,
  value: number,
): boolean | null {
  const avg = candleAverage(b, i, setting);
  return avg === null ? null : value <= avg;
}

/** `value >= setting's threshold at i`, or null while there is not enough history. */
export function aboveOrEqual(
  b: Bars,
  i: number,
  setting: SettingKey,
  value: number,
): boolean | null {
  const avg = candleAverage(b, i, setting);
  return avg === null ? null : value >= avg;
}
