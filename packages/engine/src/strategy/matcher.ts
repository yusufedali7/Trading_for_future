import { utcToLocal } from '../core/tz';
import type { UtcMs } from '../core/types';
import type { Bars } from '../features/bars';
import type { FeatureSet } from '../features/compute';
import { ema, movingMax, movingMin } from '../features/indicators';
import type { SmcSet } from '../features/smc';
import type {
  Breaker,
  Fvg,
  FeatureDirection,
  Ifvg,
  LiquiditySweep,
  OrderBlock,
  OteZone,
  StructureBreak,
  Swing,
} from '../features/types';
import { detectAllCandlePatterns } from '../patterns/candle-registry';
import type { CandlePattern, ChartPattern } from '../patterns/types';
import type { EventStep, Ref, StrategySpec, TimeWindow } from './schema';

/**
 * D65: a bar-level condition on an on-the-fly indicator series (EMA pullback, Donchian breakout) -
 * not a precomputed `features/` concept, since the period is the step's own parameter rather than
 * a global `spec.features` setting. Formed and confirmed on the same bar (no separate delay).
 */
interface IndicatorEvent {
  id: string;
  type: 'EMA_PULLBACK' | 'DONCHIAN_BREAK';
  direction: FeatureDirection;
  formedAt: UtcMs;
  formedIndex: number;
  confirmedAt: UtcMs;
  confirmedIndex: number;
  level: number;
}

type AnyDetection =
  | Swing
  | Fvg
  | StructureBreak
  | LiquiditySweep
  | OrderBlock
  | Ifvg
  | Breaker
  | OteZone
  | ChartPattern
  | IndicatorEvent
  | CandlePattern;

/** D58: `findSetups` callers that don't use any SMC step types can omit `smc` entirely. */
const EMPTY_SMC: SmcSet = {
  displacements: [],
  orderBlocks: [],
  ifvgs: [],
  breakers: [],
  equalLevels: [],
  premiumDiscount: [],
  ote: [],
  candidateSr: [],
  cisds: [],
};
/** D63: `findSetups` callers that don't use any PATTERN_EVENT step can omit `patterns` entirely. */
const EMPTY_PATTERNS: readonly ChartPattern[] = [];

export interface StepMatch {
  stepId: string;
  detectionId: string;
  formedAt: UtcMs;
  confirmedAt: UtcMs;
  confirmedIndex: number;
}

/** A complete sequence of steps; the signal is known at the close of the last step's bar. */
export interface Setup {
  id: string;
  steps: StepMatch[];
  signalIndex: number;
  /** Open time of the signal bar. */
  signalBarAt: UtcMs;
  /** Close of the signal bar: the earliest moment an order can be placed. */
  signalAt: UtcMs;
  /** Values for references such as `sweep.extreme`, all known at signalAt. */
  refs: Record<Ref, number>;
}

/** BULLISH: low dips to/through the EMA and closes back above it with a bullish bar. Mirrored. */
function emaPullbacks(b: Bars, period: number): IndicatorEvent[] {
  const series = ema(b, period);
  const out: IndicatorEvent[] = [];
  for (let i = 0; i < b.length; i++) {
    const level = series[i]!;
    if (level === null) continue;
    const bullish = b.l[i]! <= level && b.c[i]! > level && b.c[i]! > b.o[i]!;
    const bearish = b.h[i]! >= level && b.c[i]! < level && b.c[i]! < b.o[i]!;
    const direction: FeatureDirection | null = bullish ? 'BULLISH' : bearish ? 'BEARISH' : null;
    if (!direction) continue;
    out.push({
      id: `EMA_PULLBACK:${period}:${i}`,
      type: 'EMA_PULLBACK',
      direction,
      formedAt: b.t[i]!,
      formedIndex: i,
      confirmedAt: b.end[i]!,
      confirmedIndex: i,
      level,
    });
  }
  return out;
}

/** BULLISH: close breaks above the highest high of the PRIOR `period` bars (D65's `[1]` lag). */
function donchianBreaks(b: Bars, period: number): IndicatorEvent[] {
  const highs = movingMax(Array.from(b.h), period);
  const lows = movingMin(Array.from(b.l), period);
  const out: IndicatorEvent[] = [];
  for (let i = 1; i < b.length; i++) {
    const priorHigh = highs[i - 1]!;
    const priorLow = lows[i - 1]!;
    const bullish = priorHigh !== null && b.c[i]! > priorHigh;
    const bearish = priorLow !== null && b.c[i]! < priorLow;
    const direction: FeatureDirection | null = bullish ? 'BULLISH' : bearish ? 'BEARISH' : null;
    if (!direction) continue;
    out.push({
      id: `DONCHIAN_BREAK:${period}:${i}`,
      type: 'DONCHIAN_BREAK',
      direction,
      formedAt: b.t[i]!,
      formedIndex: i,
      confirmedAt: b.end[i]!,
      confirmedIndex: i,
      level: direction === 'BULLISH' ? priorHigh! : priorLow!,
    });
  }
  return out;
}

function candidates(
  step: EventStep,
  b: Bars,
  f: FeatureSet,
  smc: SmcSet,
  patterns: readonly ChartPattern[],
): AnyDetection[] {
  switch (step.type) {
    case 'LIQUIDITY_SWEEP':
      return f.sweeps.filter(
        (d) =>
          (!step.direction || d.direction === step.direction) &&
          (!step.levels?.length || step.levels.includes(d.levelKind)),
      );
    case 'STRUCTURE_BREAK':
      return f.breaks.filter(
        (d) =>
          (!step.direction || d.direction === step.direction) &&
          (!step.kind || d.kind === step.kind),
      );
    case 'FVG':
      return f.fvgs.filter((d) => !step.direction || d.direction === step.direction);
    case 'SWING':
      return f.swings.filter((d) => !step.kind || d.kind === step.kind);
    case 'ORDER_BLOCK':
      return smc.orderBlocks.filter((d) => !step.direction || d.direction === step.direction);
    case 'IFVG':
      return smc.ifvgs.filter((d) => !step.direction || d.direction === step.direction);
    case 'BREAKER':
      return smc.breakers.filter((d) => !step.direction || d.direction === step.direction);
    case 'OTE':
      return smc.ote.filter((d) => !step.direction || d.direction === step.direction);
    case 'PATTERN_EVENT':
      return patterns.filter(
        (d) =>
          d.patternId === step.patternId && (!step.direction || d.direction === step.direction),
      );
    case 'EMA_PULLBACK':
      return emaPullbacks(b, step.period).filter(
        (d) => !step.direction || d.direction === step.direction,
      );
    case 'DONCHIAN_BREAK':
      return donchianBreaks(b, step.period).filter(
        (d) => !step.direction || d.direction === step.direction,
      );
    case 'CANDLE_PATTERN_EVENT':
      // On the fly like EMA_PULLBACK/DONCHIAN_BREAK (D65), not caller-precomputed like
      // PATTERN_EVENT's ChartPattern (D63) - no extra dependency (e.g. swings) to share, so
      // there's nothing a caller would need to compute once and pass in.
      return detectAllCandlePatterns(b).filter(
        (d) =>
          d.patternId === step.patternId && (!step.direction || d.direction === step.direction),
      );
  }
}

function values(d: AnyDetection, b: Bars): Record<string, number> {
  switch (d.type) {
    case 'LIQUIDITY_SWEEP':
      return { level: d.level, extreme: d.extreme };
    case 'STRUCTURE_BREAK':
      return { level: d.level };
    case 'FVG':
    case 'ORDER_BLOCK':
    case 'IFVG':
    case 'BREAKER':
      return { top: d.top, bottom: d.bottom, mid: (d.top + d.bottom) / 2 };
    case 'OTE':
      return { top: d.top, bottom: d.bottom, mid: (d.top + d.bottom) / 2, sweetSpot: d.sweetSpot };
    case 'SWING':
      return { price: d.price };
    case 'PATTERN_EVENT': {
      const out: Record<string, number> = { confirmationRef: d.confirmationRef };
      if (d.targetPrice !== null) out.targetPrice = d.targetPrice;
      if (d.invalidationRef !== null) out.invalidationRef = d.invalidationRef;
      return out;
    }
    case 'EMA_PULLBACK':
    case 'DONCHIAN_BREAK':
      return { level: d.level };
    case 'CANDLE_PATTERN_EVENT':
      return { low: b.l[d.confirmedIndex]!, high: b.h[d.confirmedIndex]! };
  }
}

const byConfirmation = (a: AnyDetection, b: AnyDetection) =>
  a.confirmedIndex - b.confirmedIndex || a.formedIndex - b.formedIndex || a.id.localeCompare(b.id);

/** First index with list[i].confirmedIndex >= x. */
function firstFrom(list: readonly AnyDetection[], x: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.confirmedIndex < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Whether the bar opening at t starts inside the local-time window ([start, end), may wrap midnight). */
export function inWindow(w: TimeWindow | null, t: UtcMs): boolean {
  if (!w) return true;
  const l = utcToLocal(t, w.tz);
  const m = l.hour * 60 + l.minute;
  const [sh, sm] = w.start.split(':').map(Number);
  const [eh, em] = w.end.split(':').map(Number);
  const s = (sh ?? 0) * 60 + (sm ?? 0);
  const e = (eh ?? 0) * 60 + (em ?? 0);
  return s < e ? m >= s && m < e : m >= s || m < e;
}

/**
 * Setups of a strategy, definition v1 (D31). For every candidate of the first step, in
 * confirmation order, each later step takes the earliest candidate confirmed on or after the
 * previous step's bar and at most `maxBars` bars later. The setup is known at the close of the
 * last step's bar and must start inside the window. Several first-step candidates leading to
 * the same last detection give one setup (the first). Only uses detections confirmed by the
 * signal, so setups found on data cut at T are exactly those of the full data known by T.
 * `smc` (D58) is optional - only strategies with an `ORDER_BLOCK`/`IFVG`/`BREAKER`/`OTE` step
 * need it; the other 4 SMC concepts (Displacement, Equal Levels, Premium/Discount, Candidate
 * S/R) have no single direction/invalidation price and so have no step type at all (same reason
 * they're not in `Detection` - see `features/smc.ts` and the `docs/definitions/*-v1.md` files).
 * `patterns` (D63) is optional likewise - only strategies with a `PATTERN_EVENT` step need it.
 * `spec.trendFilter` (D65) is checked only at the final signal bar, like `window` - it is not a
 * sequence step, so it never appears in `spec.steps` or affects per-step chaining.
 */
export function findSetups(
  spec: StrategySpec,
  b: Bars,
  f: FeatureSet,
  smc: SmcSet = EMPTY_SMC,
  patterns: readonly ChartPattern[] = EMPTY_PATTERNS,
): Setup[] {
  const lists = spec.steps.map((s) => candidates(s, b, f, smc, patterns).sort(byConfirmation));
  const tf = spec.trendFilter;
  const fastE = tf ? ema(b, tf.fast) : null;
  const slowE = tf ? ema(b, tf.slow) : null;
  const trendOk = (i: number): boolean => {
    if (!tf || !fastE || !slowE) return true;
    const f2 = fastE[i]!;
    const s2 = slowE[i]!;
    if (f2 === null || s2 === null) return false;
    const c = b.c[i]!;
    return spec.direction === 'LONG' ? c > s2 && f2 > s2 : c < s2 && f2 < s2;
  };
  const out: Setup[] = [];
  const usedSignals = new Set<string>();
  for (const first of lists[0] ?? []) {
    const chain: AnyDetection[] = [first];
    for (let k = 1; k < spec.steps.length; k++) {
      const prev = chain[k - 1]!;
      const max = prev.confirmedIndex + (spec.steps[k]!.maxBars ?? 0);
      const list = lists[k]!;
      let found: AnyDetection | null = null;
      for (let i = firstFrom(list, prev.confirmedIndex); i < list.length; i++) {
        const d = list[i]!;
        if (d.confirmedIndex > max) break;
        if (!chain.some((c) => c.id === d.id)) {
          found = d;
          break;
        }
      }
      if (!found) break;
      chain.push(found);
    }
    if (chain.length < spec.steps.length) continue;
    const last = chain[chain.length - 1]!;
    if (usedSignals.has(last.id)) continue;
    const signalIndex = last.confirmedIndex;
    if (
      signalIndex >= b.length ||
      !inWindow(spec.window, b.t[signalIndex]!) ||
      !trendOk(signalIndex)
    )
      continue;
    usedSignals.add(last.id);
    const refs: Record<Ref, number> = {};
    chain.forEach((d, k) => {
      for (const [field, v] of Object.entries(values(d, b)))
        refs[`${spec.steps[k]!.id}.${field}`] = v;
    });
    out.push({
      id: `SETUP:${chain.map((d) => d.id).join('|')}`,
      steps: chain.map((d, k) => ({
        stepId: spec.steps[k]!.id,
        detectionId: d.id,
        formedAt: d.formedAt,
        confirmedAt: d.confirmedAt,
        confirmedIndex: d.confirmedIndex,
      })),
      signalIndex,
      signalBarAt: b.t[signalIndex]!,
      signalAt: b.end[signalIndex]!,
      refs,
    });
  }
  return out.sort((a, c) => a.signalIndex - c.signalIndex || a.id.localeCompare(c.id));
}
