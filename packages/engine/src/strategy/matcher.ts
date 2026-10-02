import { utcToLocal } from '../core/tz';
import type { UtcMs } from '../core/types';
import type { Bars } from '../features/bars';
import type { FeatureSet } from '../features/compute';
import type { Fvg, LiquiditySweep, StructureBreak, Swing } from '../features/types';
import type { EventStep, Ref, StrategySpec, TimeWindow } from './schema';

type AnyDetection = Swing | Fvg | StructureBreak | LiquiditySweep;

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

function candidates(step: EventStep, f: FeatureSet): AnyDetection[] {
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
  }
}

function values(d: AnyDetection): Record<string, number> {
  switch (d.type) {
    case 'LIQUIDITY_SWEEP':
      return { level: d.level, extreme: d.extreme };
    case 'STRUCTURE_BREAK':
      return { level: d.level };
    case 'FVG':
      return { top: d.top, bottom: d.bottom, mid: (d.top + d.bottom) / 2 };
    case 'SWING':
      return { price: d.price };
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
 */
export function findSetups(spec: StrategySpec, b: Bars, f: FeatureSet): Setup[] {
  const lists = spec.steps.map((s) => candidates(s, f).sort(byConfirmation));
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
    if (signalIndex >= b.length || !inWindow(spec.window, b.t[signalIndex]!)) continue;
    usedSignals.add(last.id);
    const refs: Record<Ref, number> = {};
    chain.forEach((d, k) => {
      for (const [field, v] of Object.entries(values(d))) refs[`${spec.steps[k]!.id}.${field}`] = v;
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
