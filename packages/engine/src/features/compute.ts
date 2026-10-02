import { timeframeMs, type Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';
import type { ResampledCandle } from '../data/resample';
import type { Instrument } from '../instruments/registry';
import type { SessionLevels } from '../session/levels';
import { toBars } from './bars';
import { FVG_DEFAULTS, detectFvgs } from './fvg';
import { periodLevels } from './periods';
import { STRUCTURE_DEFAULTS, detectStructureBreaks } from './structure';
import { SWEEP_DEFAULTS, detectSweeps, liquidityLevels } from './sweep';
import { SWING_DEFAULTS, detectSwings } from './swing';
import type {
  Fvg,
  FvgParams,
  LiquiditySweep,
  PeriodLevel,
  StructureBreak,
  StructureBreakParams,
  SweepParams,
  Swing,
  SwingParams,
} from './types';

export interface FeatureParams {
  swing: SwingParams;
  fvg: FvgParams;
  structure: StructureBreakParams;
  sweep: SweepParams;
}

export const FEATURE_DEFAULTS: FeatureParams = {
  swing: SWING_DEFAULTS,
  fvg: FVG_DEFAULTS,
  structure: STRUCTURE_DEFAULTS,
  sweep: SWEEP_DEFAULTS,
};

/** Definition versions used by this engine; stored with every result that relies on them. */
export const FEATURE_DEFINITIONS = {
  SWING: 'v1',
  FVG: 'v1',
  STRUCTURE_BREAK: 'v1',
  LIQUIDITY_SWEEP: 'v1',
  PERIOD_LEVEL: 'v1',
} as const;

export interface FeatureSet {
  swings: Swing[];
  fvgs: Fvg[];
  breaks: StructureBreak[];
  sweeps: LiquiditySweep[];
  /** Previous day and week levels (from the base series, independent of the chart timeframe). */
  periods: PeriodLevel[];
}

/** Previous day and week levels as known at `asOf`. */
export function previousPeriods(
  series: CandleSeries,
  inst: Instrument,
  asOf: UtcMs,
  baseTimeframe: Timeframe = '1m',
): PeriodLevel[] {
  return [
    ...periodLevels(series, inst, 'DAY', asOf, baseTimeframe),
    ...periodLevels(series, inst, 'WEEK', asOf, baseTimeframe),
  ];
}

export interface FeatureInput {
  /** Chart timeframe candles; a still-forming last candle is ignored. */
  candles: readonly ResampledCandle[];
  inst: Instrument;
  tf: Timeframe;
  periods: readonly PeriodLevel[];
  sessions: readonly SessionLevels[];
}

/**
 * Every v1 feature on one timeframe. The single entry point for the chart, replay and (M5)
 * backtest, so all of them see the same candidates (CLAUDE.md "one engine, two consumers").
 */
export function computeFeatures(
  input: FeatureInput,
  p: FeatureParams = FEATURE_DEFAULTS,
): FeatureSet {
  const b = toBars(input.candles, input.inst, input.tf);
  const swings = detectSwings(b, p.swing);
  const levels = liquidityLevels(
    input.inst,
    {
      swings,
      periods: input.periods,
      sessions: input.sessions,
      barMs: timeframeMs(input.tf),
    },
    p.sweep,
  );
  return {
    swings,
    fvgs: detectFvgs(b, input.inst, p.fvg),
    breaks: detectStructureBreaks(b, swings, p.structure),
    sweeps: detectSweeps(b, levels),
    periods: [...input.periods],
  };
}

const known = <T extends { confirmedAt: UtcMs }>(xs: readonly T[], cutoff: UtcMs) =>
  xs.filter((x) => x.confirmedAt <= cutoff);
const until = (at: UtcMs | null, cutoff: UtcMs) => (at !== null && at <= cutoff ? at : null);

/**
 * The features as they were known at `cutoff` (the replay cursor): detections confirmed later
 * are dropped and later gap touches/fills are not yet known. Equal to computing the features on
 * data cut at `cutoff` (truncation invariance, tested).
 */
export function featuresAsOf(f: FeatureSet, cutoff: UtcMs): FeatureSet {
  return {
    swings: known(f.swings, cutoff),
    fvgs: known(f.fvgs, cutoff).map((g) => ({
      ...g,
      touchedAt: until(g.touchedAt, cutoff),
      filledAt: until(g.filledAt, cutoff),
    })),
    breaks: known(f.breaks, cutoff),
    sweeps: known(f.sweeps, cutoff),
    periods: f.periods.filter((x) => x.knownAt <= cutoff),
  };
}
