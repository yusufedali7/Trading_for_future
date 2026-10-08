import type { FeatureSet, SmcSet } from '@trw/engine';
import { timeToPosition } from '../coords';

/** Toggleable candidate layers (stored in prefs). */
export const FEATURE_LAYERS = [
  'SWING',
  'FVG',
  'STRUCTURE',
  'SWEEP',
  'PREV_DAY',
  'PREV_WEEK',
  'ORDER_BLOCK',
  'IFVG',
  'BREAKER',
  'EQUAL_LEVELS',
  'PREMIUM_DISCOUNT',
  'OTE',
  'CANDIDATE_SR',
] as const;
export type FeatureLayer = (typeof FEATURE_LAYERS)[number];

/** Display only: a gap box is drawn for at most this many bars (the engine keeps its state). */
export const FVG_BOX_MAX_BARS = 50;

export type Tone = 'NEUTRAL' | 'UP' | 'DOWN' | 'SWEEP' | 'DAY' | 'WEEK' | 'SETUP';

/** Strategy setups shown on the chart (M5): always drawn when given, not a toggle layer. */
export interface ChartSetups {
  /** Signal bar open time and the price beside which the mark sits (bar low for longs, high for shorts). */
  marks: readonly { t: number; price: number }[];
  long: boolean;
  label: string;
}

/** A candidate placed on the logical (bar position) axis; prices stay prices. */
export type FeatureItem =
  | {
      shape: 'MARK';
      layer: FeatureLayer | 'SETUP';
      p: number;
      price: number;
      above: boolean;
      /** 0 next to the wick; marks sharing a bar and side are stacked outwards. */
      stack: number;
      tone: Tone;
      label: string;
    }
  | {
      shape: 'BOX';
      layer: FeatureLayer | 'SETUP';
      p1: number;
      /** null: still open, extends to the newest bar. */
      p2: number | null;
      top: number;
      bottom: number;
      tone: Tone;
      label: string;
    }
  | {
      shape: 'LINE';
      layer: FeatureLayer | 'SETUP';
      p1: number;
      p2: number | null;
      price: number;
      tone: Tone;
      label: string;
      dashed: boolean;
    };

export interface FeatureLabels {
  fvg: (up: boolean) => string;
  structure: (kind: 'BOS' | 'CHOCH', up: boolean) => string;
  /** All levels swept by one bar on one side. */
  sweep: (levelKinds: readonly string[]) => string;
  swing: (high: boolean) => string;
  period: (kind: 'PDH' | 'PDL' | 'PWH' | 'PWL') => string;
}

/**
 * Turns engine candidates into chart items on the bar-position axis. Positions are computed
 * once per data change; the renderer only filters by the visible range and maps to pixels.
 */
export function layoutFeatures(
  f: FeatureSet,
  layers: ReadonlySet<FeatureLayer>,
  times: ArrayLike<number>,
  tfMs: number,
  labels: FeatureLabels,
  setups: ChartSetups | null = null,
): FeatureItem[] {
  const pos = (t: number) => timeToPosition(times, tfMs, t);
  /** Position of the bar that opened at t (its centre); detections refer to bar open times. */
  const bar = (t: number) => pos(t) + 0.5;
  const out: FeatureItem[] = [];

  if (layers.has('PREV_DAY') || layers.has('PREV_WEEK'))
    for (const d of f.periods) {
      const layer = d.period === 'DAY' ? 'PREV_DAY' : 'PREV_WEEK';
      if (!layers.has(layer)) continue;
      const tone = d.period === 'DAY' ? 'DAY' : 'WEEK';
      const [hi, lo] = d.period === 'DAY' ? (['PDH', 'PDL'] as const) : (['PWH', 'PWL'] as const);
      const p1 = pos(d.knownAt);
      const p2 = pos(d.validUntil);
      out.push({
        shape: 'LINE',
        layer,
        p1,
        p2,
        price: d.high,
        tone,
        label: labels.period(hi),
        dashed: true,
      });
      out.push({
        shape: 'LINE',
        layer,
        p1,
        p2,
        price: d.low,
        tone,
        label: labels.period(lo),
        dashed: true,
      });
    }

  if (layers.has('FVG'))
    for (const g of f.fvgs) {
      const up = g.direction === 'BULLISH';
      const p1 = pos(g.formedAt);
      const cap = p1 + FVG_BOX_MAX_BARS;
      const filled = g.filledAt === null ? null : pos(g.filledAt);
      // Open gaps run to the newest bar unless they are older than the display cap.
      const p2 = filled !== null ? Math.min(filled, cap) : cap < times.length - 0.5 ? cap : null;
      out.push({
        shape: 'BOX',
        layer: 'FVG',
        p1,
        p2,
        top: g.top,
        bottom: g.bottom,
        tone: up ? 'UP' : 'DOWN',
        label: labels.fvg(up),
      });
    }

  if (layers.has('STRUCTURE'))
    for (const s of f.breaks) {
      const up = s.direction === 'BULLISH';
      out.push({
        shape: 'LINE',
        layer: 'STRUCTURE',
        p1: bar(s.swingAt),
        p2: bar(s.formedAt),
        price: s.level,
        tone: up ? 'UP' : 'DOWN',
        label: labels.structure(s.kind, up),
        dashed: s.kind === 'BOS',
      });
    }

  if (layers.has('SWING'))
    for (const s of f.swings) {
      const high = s.kind === 'HIGH';
      out.push({
        shape: 'MARK',
        layer: 'SWING',
        p: bar(s.formedAt),
        price: s.price,
        above: high,
        stack: 0,
        tone: 'NEUTRAL',
        label: labels.swing(high),
      });
    }

  if (layers.has('SWEEP'))
    for (let i = 0; i < f.sweeps.length;) {
      // One bar can sweep several levels on the same side: one mark, one combined label.
      const s = f.sweeps[i]!;
      const kinds: string[] = [];
      let j = i;
      while (
        j < f.sweeps.length &&
        f.sweeps[j]!.formedAt === s.formedAt &&
        f.sweeps[j]!.direction === s.direction
      )
        kinds.push(f.sweeps[j++]!.levelKind);
      i = j;
      out.push({
        shape: 'MARK',
        layer: 'SWEEP',
        p: bar(s.formedAt),
        price: s.extreme,
        above: s.direction === 'BEARISH',
        stack: 0,
        tone: 'SWEEP',
        label: labels.sweep(kinds),
      });
    }

  if (setups)
    for (const m of setups.marks)
      out.push({
        shape: 'MARK',
        layer: 'SETUP',
        p: bar(m.t),
        price: m.price,
        above: !setups.long,
        stack: 0,
        tone: 'SETUP',
        label: setups.label,
      });

  // Stack marks that share a bar and side (a swing high that was also a sweep, say).
  const seen = new Map<string, number>();
  for (const it of out) {
    if (it.shape !== 'MARK') continue;
    const key = `${it.p}:${it.above}`;
    it.stack = seen.get(key) ?? 0;
    seen.set(key, it.stack + 1);
  }
  return out;
}

export interface SmcLabels {
  orderBlock: (up: boolean) => string;
  ifvg: (up: boolean) => string;
  breaker: (up: boolean) => string;
  equalLevels: (high: boolean) => string;
  premiumDiscount: string;
  ote: (up: boolean) => string;
  candidateSr: string;
}

/**
 * M9 2.–3. dilim's SMC candidates (order block, IFVG, breaker, equal highs/lows, premium/
 * discount, OTE, candidate S/R), separately from `layoutFeatures` because they come from
 * `computeSmc`'s own `SmcSet`, not `FeatureSet` (D49/D50 - decoupled from the M4 pipeline for
 * now). Boxes that have no engine-tracked end (order block, IFVG, breaker, OTE, candidate S/R)
 * reuse the same "cap at `FVG_BOX_MAX_BARS`, open to the newest bar otherwise" display-only rule
 * as FVG boxes.
 */
export function layoutSmc(
  s: SmcSet,
  layers: ReadonlySet<FeatureLayer>,
  times: ArrayLike<number>,
  tfMs: number,
  labels: SmcLabels,
): FeatureItem[] {
  const pos = (t: number) => timeToPosition(times, tfMs, t);
  const bar = (t: number) => pos(t) + 0.5;
  const openEnd = (p1: number) => {
    const cap = p1 + FVG_BOX_MAX_BARS;
    return cap < times.length - 0.5 ? cap : null;
  };
  const out: FeatureItem[] = [];

  if (layers.has('ORDER_BLOCK'))
    for (const ob of s.orderBlocks) {
      const up = ob.direction === 'BULLISH';
      const p1 = pos(ob.formedAt);
      out.push({
        shape: 'BOX',
        layer: 'ORDER_BLOCK',
        p1,
        p2: openEnd(p1),
        top: ob.top,
        bottom: ob.bottom,
        tone: up ? 'UP' : 'DOWN',
        label: labels.orderBlock(up),
      });
    }

  if (layers.has('IFVG'))
    for (const g of s.ifvgs) {
      const up = g.direction === 'BULLISH';
      const p1 = pos(g.formedAt);
      out.push({
        shape: 'BOX',
        layer: 'IFVG',
        p1,
        p2: openEnd(p1),
        top: g.top,
        bottom: g.bottom,
        tone: up ? 'UP' : 'DOWN',
        label: labels.ifvg(up),
      });
    }

  if (layers.has('BREAKER'))
    for (const bk of s.breakers) {
      const up = bk.direction === 'BULLISH';
      const p1 = pos(bk.formedAt);
      out.push({
        shape: 'BOX',
        layer: 'BREAKER',
        p1,
        p2: openEnd(p1),
        top: bk.top,
        bottom: bk.bottom,
        tone: up ? 'UP' : 'DOWN',
        label: labels.breaker(up),
      });
    }

  if (layers.has('OTE'))
    for (const z of s.ote) {
      const up = z.direction === 'BULLISH';
      const p1 = pos(z.formedAt);
      out.push({
        shape: 'BOX',
        layer: 'OTE',
        p1,
        p2: openEnd(p1),
        top: z.top,
        bottom: z.bottom,
        tone: up ? 'UP' : 'DOWN',
        label: labels.ote(up),
      });
    }

  if (layers.has('CANDIDATE_SR'))
    for (const z of s.candidateSr) {
      const p1 = pos(z.formedAt);
      out.push({
        shape: 'BOX',
        layer: 'CANDIDATE_SR',
        p1,
        p2: openEnd(p1),
        top: z.top,
        bottom: z.bottom,
        tone: 'NEUTRAL',
        label: labels.candidateSr,
      });
    }

  if (layers.has('EQUAL_LEVELS'))
    for (const e of s.equalLevels) {
      out.push({
        shape: 'LINE',
        layer: 'EQUAL_LEVELS',
        p1: bar(e.formedAt),
        p2: pos(e.confirmedAt),
        price: e.price,
        tone: 'NEUTRAL',
        label: labels.equalLevels(e.side === 'HIGH'),
        dashed: true,
      });
    }

  if (layers.has('PREMIUM_DISCOUNT'))
    for (let i = 0; i < s.premiumDiscount.length; i++) {
      const z = s.premiumDiscount[i]!;
      const next = s.premiumDiscount[i + 1];
      out.push({
        shape: 'LINE',
        layer: 'PREMIUM_DISCOUNT',
        p1: pos(z.confirmedAt),
        p2: next ? pos(next.confirmedAt) : null,
        price: z.equilibrium,
        tone: 'NEUTRAL',
        label: labels.premiumDiscount,
        dashed: true,
      });
    }

  return out;
}

/** Items that overlap the visible logical range; open-ended items run to `lastPos`. */
export function visibleItems(
  items: readonly FeatureItem[],
  from: number,
  to: number,
  lastPos: number,
): FeatureItem[] {
  return items.filter((it) => {
    if (it.shape === 'MARK') return it.p >= from - 1 && it.p <= to + 1;
    const end = it.p2 ?? lastPos;
    return end >= from && it.p1 <= to;
  });
}
