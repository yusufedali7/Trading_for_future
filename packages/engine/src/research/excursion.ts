import { randomInt, type Rng } from '../core/rng';
import type { Bars } from '../features/bars';
import type { FeatureDirection } from '../features/types';

/**
 * Event-store outcome measurement (`docs/AGENT-GOREV-M9-formasyonlar.md` Adım 4: "her olay için
 * ... MFE/MAE ... aynı mesafede rastgele bir kontrol seviyesi de ölçülür", modelled on
 * `catalog/experiments/fvg_random_walk.py`'s method). Not a trade simulation - a candidate's
 * confirmation close stands in for a hypothetical entry, and MFE/MAE (price units, always
 * measured in the candidate's *expected* direction) show how far price moved for and against it
 * over fixed horizons.
 *
 * **Interpretation choice, not in the task file (flagged per CLAUDE.md):** the reference script
 * compares a detected level's revisit rate against a random level held the *same distance* from
 * price. For MFE/MAE specifically that framing doesn't carry over cleanly (MFE/MAE describes a
 * price path from a point in time, not a level), so the control here is MFE/MAE measured from a
 * **uniformly random bar** over the same horizons - "is the follow-through after this candidate
 * any different from the follow-through after a random moment?" rather than "...after a random
 * price level?". Both are legitimate baselines; this one was picked for being directly
 * comparable to the real measurement without inventing a second, unrelated statistic.
 */

export interface Excursion {
  horizonBars: number;
  /** Best move in the expected direction within the horizon (price units, always >= 0). */
  mfe: number;
  /** Worst move against the expected direction within the horizon (price units, always >= 0). */
  mae: number;
}

export interface ExcursionReport {
  id: string;
  /** `null` while the horizon's last bar has not closed yet (CLAUDE.md rule 3). */
  excursions: (Excursion | null)[];
  /** Same horizons, measured from a random bar instead of this candidate's confirmation. */
  control: (Excursion | null)[];
}

function excursionFrom(
  b: Bars,
  fromIndex: number,
  entryPrice: number,
  direction: FeatureDirection,
  horizons: readonly number[],
): (Excursion | null)[] {
  const maxHorizon = Math.max(...horizons);
  const sorted = [...horizons].sort((x, y) => x - y);
  let mfe = 0;
  let mae = 0;
  const byHorizon = new Map<number, Excursion>();
  let next = 0;
  for (let k = 1; k <= maxHorizon; k++) {
    const i = fromIndex + k;
    if (i >= b.length) break;
    const favorable = direction === 'BULLISH' ? b.h[i]! - entryPrice : entryPrice - b.l[i]!;
    const adverse = direction === 'BULLISH' ? entryPrice - b.l[i]! : b.h[i]! - entryPrice;
    mfe = Math.max(mfe, favorable);
    mae = Math.max(mae, adverse);
    while (next < sorted.length && sorted[next] === k) {
      byHorizon.set(k, { horizonBars: k, mfe, mae });
      next++;
    }
  }
  return horizons.map((h) => byHorizon.get(h) ?? null);
}

/**
 * MFE/MAE at each of `horizons` bars after `confirmedIndex`, plus the same measurement from a
 * random bar (the "control"). `rng` must be seeded by the caller and the seed recorded (rule 5).
 */
export function detectionExcursions(
  b: Bars,
  d: { id: string; confirmedIndex: number; direction: FeatureDirection },
  horizons: readonly number[],
  rng: Rng,
): ExcursionReport {
  const entryPrice = b.c[d.confirmedIndex]!;
  const excursions = excursionFrom(b, d.confirmedIndex, entryPrice, d.direction, horizons);
  const maxHorizon = Math.max(...horizons);
  const roomEnd = b.length - 1 - maxHorizon;
  let control: (Excursion | null)[];
  if (roomEnd <= 0) {
    control = horizons.map(() => null);
  } else {
    const controlIndex = randomInt(rng, roomEnd);
    const controlDirection: FeatureDirection = rng() < 0.5 ? 'BULLISH' : 'BEARISH';
    control = excursionFrom(b, controlIndex, b.c[controlIndex]!, controlDirection, horizons);
  }
  return { id: d.id, excursions, control };
}

export interface ExcursionSummary {
  horizonBars: number;
  n: number;
  avgMfe: number;
  avgMae: number;
  controlN: number;
  controlAvgMfe: number;
  controlAvgMae: number;
}

/** Averages MFE/MAE per horizon across many reports (only horizons known so far). */
export function summarizeExcursions(
  reports: readonly ExcursionReport[],
  horizons: readonly number[],
): ExcursionSummary[] {
  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  return horizons.map((h, idx) => {
    const real = reports.map((r) => r.excursions[idx]).filter((x): x is Excursion => x !== null);
    const ctrl = reports.map((r) => r.control[idx]).filter((x): x is Excursion => x !== null);
    return {
      horizonBars: h,
      n: real.length,
      avgMfe: avg(real.map((x) => x.mfe)),
      avgMae: avg(real.map((x) => x.mae)),
      controlN: ctrl.length,
      controlAvgMfe: avg(ctrl.map((x) => x.mfe)),
      controlAvgMae: avg(ctrl.map((x) => x.mae)),
    };
  });
}
