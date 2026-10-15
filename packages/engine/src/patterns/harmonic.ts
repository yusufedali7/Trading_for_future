import type { Swing } from '../features/types';
import { pivotWindows } from './chart-shared';
import type { HarmonicPattern, HarmonicPatternPivot } from './types';

/**
 * Harmonic (XABCD) patterns, catalog `catalog/patterns/harmonic.json`. Pivots come from the M4
 * swing engine (v1), with the catalog's own `left=right=5` setting (`CHART_PIVOT_PARAMS` from
 * `chart-shared.ts` - callers pass the same swings used for the chart-pattern family).
 *
 * `shark` was blocked until D78: its three ratios are now cross-checked across four sources (see
 * `detectShark`). The other 8 patterns' ratio sets were cross-checked this
 * session against independent sources (LuxAlgo, HarmonicTrader.com, HowToTrade, LiteFinance,
 * TradingSim - see D58) before being coded; all matched the catalog exactly except Crab's
 * `CD_BC` lower bound, where sources disagree (2.24 vs. 2.618 - the catalog's 2.24 was kept
 * as-is, not resolved, and that disagreement is noted rather than silently picked).
 *
 * Unlike the chart-pattern family, a harmonic pattern has no separate breakout/confirmation step
 * in the catalog - the ratios at D *are* the signal (the "PRZ", potential reversal zone), known
 * as soon as D's own swing is confirmed.
 */

const PCT_ERROR = 0.05;

function inRange(value: number, range: readonly [number, number], pctError: number): boolean {
  const lo = Math.min(range[0], range[1]) * (1 - pctError);
  const hi = Math.max(range[0], range[1]) * (1 + pctError);
  return value >= lo && value <= hi;
}

function pivotRecord(s: Swing, label: HarmonicPatternPivot['label']): HarmonicPatternPivot {
  return { at: s.formedAt, index: s.formedIndex, price: s.price, kind: s.kind, label };
}

function makeHarmonicPattern(
  patternId: string,
  ratioSetSource: string,
  direction: 'BULLISH' | 'BEARISH',
  points: readonly [Swing, Swing, Swing, Swing, Swing] | readonly [Swing, Swing, Swing, Swing],
  labels: readonly HarmonicPatternPivot['label'][],
  ratios: Record<string, number>,
): HarmonicPattern {
  const d = points[points.length - 1]!;
  const x = points[0]!;
  return {
    id: `HARMONIC:v1:${patternId}:${ratioSetSource}:${x.formedAt}:${d.formedAt}`,
    patternId,
    ratioSetSource,
    defVersion: 'v1',
    direction,
    pivots: points.map((s, i) => pivotRecord(s, labels[i]!)),
    formedAt: d.formedAt,
    formedIndex: d.formedIndex,
    confirmedAt: d.confirmedAt,
    confirmedIndex: d.confirmedIndex,
    ratios,
  };
}

interface XabcdRatios {
  AB_XA: readonly [number, number];
  BC_AB: readonly [number, number];
  /** `null` when the catalog's own ratio_set has no CD_BC constraint (e.g. butterfly - D is pinned by AD_XA alone). */
  CD_BC: readonly [number, number] | null;
  AD_XA: readonly [number, number];
}

const XABCD_LABELS = ['X', 'A', 'B', 'C', 'D'] as const;
const SHARK_LABELS = ['0', 'X', 'A', 'B', 'C'] as const;

/** The standard Gartley/Butterfly/Bat/Crab-family XABCD ratio check, one zigzag direction. */
function detectXabcdDirection(
  swings: readonly Swing[],
  direction: 'BULLISH' | 'BEARISH',
  ratios: XabcdRatios,
  patternId: string,
  source: string,
): HarmonicPattern[] {
  const kinds =
    direction === 'BULLISH'
      ? (['LOW', 'HIGH', 'LOW', 'HIGH', 'LOW'] as const)
      : (['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH'] as const);
  const out: HarmonicPattern[] = [];
  for (const [x, a, b, c, d] of pivotWindows(swings, kinds)) {
    const XA = Math.abs(a!.price - x!.price);
    const AB = Math.abs(b!.price - a!.price);
    const BC = Math.abs(c!.price - b!.price);
    const CD = Math.abs(d!.price - c!.price);
    const AD = Math.abs(d!.price - a!.price);
    if (XA === 0 || AB === 0 || BC === 0) continue;
    const AB_XA = AB / XA;
    const BC_AB = BC / AB;
    const CD_BC = CD / BC;
    const AD_XA = AD / XA;
    if (!inRange(AB_XA, ratios.AB_XA, PCT_ERROR)) continue;
    if (!inRange(BC_AB, ratios.BC_AB, PCT_ERROR)) continue;
    if (ratios.CD_BC != null && !inRange(CD_BC, ratios.CD_BC, PCT_ERROR)) continue;
    if (!inRange(AD_XA, ratios.AD_XA, PCT_ERROR)) continue;
    out.push(
      makeHarmonicPattern(patternId, source, direction, [x!, a!, b!, c!, d!], XABCD_LABELS, {
        AB_XA,
        BC_AB,
        CD_BC,
        AD_XA,
      }),
    );
  }
  return out;
}

function detectXabcd(
  swings: readonly Swing[],
  patternId: string,
  ratioSets: readonly { source: string; ratios: XabcdRatios }[],
): HarmonicPattern[] {
  const out: HarmonicPattern[] = [];
  for (const rs of ratioSets) {
    out.push(...detectXabcdDirection(swings, 'BULLISH', rs.ratios, patternId, rs.source));
    out.push(...detectXabcdDirection(swings, 'BEARISH', rs.ratios, patternId, rs.source));
  }
  return out;
}

/** `neurotrader888/TechnicalAnalysisAutomation` and `ggne/harmonic-pattern-pine` - see D58. */
export function detectGartley(swings: readonly Swing[]): HarmonicPattern[] {
  return detectXabcd(swings, 'gartley', [
    {
      source: 'neurotrader888/TechnicalAnalysisAutomation',
      ratios: {
        AB_XA: [0.618, 0.618],
        BC_AB: [0.382, 0.886],
        CD_BC: [1.13, 1.618],
        AD_XA: [0.786, 0.786],
      },
    },
    {
      source: 'ggne/harmonic-pattern-pine',
      ratios: {
        AB_XA: [0.618, 0.618],
        BC_AB: [0.382, 0.886],
        CD_BC: [1.27, 1.618],
        AD_XA: [0.786, 0.786],
      },
    },
  ]);
}

export function detectButterfly(swings: readonly Swing[]): HarmonicPattern[] {
  return detectXabcd(swings, 'butterfly', [
    {
      source: 'neurotrader888/TechnicalAnalysisAutomation',
      ratios: { AB_XA: [0.786, 0.786], BC_AB: [0.382, 0.886], CD_BC: null, AD_XA: [1.27, 1.41] },
    },
    {
      source: 'ggne/harmonic-pattern-pine',
      ratios: { AB_XA: [0.786, 0.786], BC_AB: [0.382, 0.886], CD_BC: null, AD_XA: [1.27, 1.27] },
    },
  ]);
}

/** Cross-checked against LuxAlgo/HowToTrade/TradeJini (Carney's ratios) - see D58. */
export function detectBat(swings: readonly Swing[]): HarmonicPattern[] {
  return detectXabcd(swings, 'bat', [
    {
      source: 'Carney (cross-checked D58)',
      ratios: {
        AB_XA: [0.382, 0.5],
        BC_AB: [0.382, 0.886],
        CD_BC: [1.618, 2.618],
        AD_XA: [0.886, 0.886],
      },
    },
  ]);
}

export function detectAltBat(swings: readonly Swing[]): HarmonicPattern[] {
  return detectXabcd(swings, 'alt_bat', [
    {
      source: 'Carney (cross-checked D58)',
      ratios: {
        AB_XA: [0.382, 0.382],
        BC_AB: [0.382, 0.886],
        CD_BC: [2.0, 3.618],
        AD_XA: [1.13, 1.13],
      },
    },
  ]);
}

/**
 * `CD_BC` lower bound (2.24) is kept as the catalog has it; an independent cross-check (D58)
 * found 2.618 cited elsewhere for the same pattern - sources disagree, not resolved here.
 */
export function detectCrab(swings: readonly Swing[]): HarmonicPattern[] {
  return detectXabcd(swings, 'crab', [
    {
      source: 'Carney (cross-checked D58, CD_BC lower bound disputed)',
      ratios: {
        AB_XA: [0.382, 0.618],
        BC_AB: [0.382, 0.886],
        CD_BC: [2.24, 3.618],
        AD_XA: [1.618, 1.618],
      },
    },
  ]);
}

export function detectDeepCrab(swings: readonly Swing[]): HarmonicPattern[] {
  return detectXabcd(swings, 'deep_crab', [
    {
      source: 'Carney (cross-checked D58)',
      ratios: {
        AB_XA: [0.886, 0.886],
        BC_AB: [0.382, 0.886],
        CD_BC: [2.0, 3.618],
        AD_XA: [1.618, 1.618],
      },
    },
  ]);
}

/**
 * Cypher (Darren Oglesbee): C extends *beyond* A, and D is keyed off the XC leg, not XA - a
 * different ratio shape from the Gartley-descended patterns above (cross-checked D58).
 */
export function detectCypher(swings: readonly Swing[]): HarmonicPattern[] {
  const out: HarmonicPattern[] = [];
  for (const direction of ['BULLISH', 'BEARISH'] as const) {
    const kinds =
      direction === 'BULLISH'
        ? (['LOW', 'HIGH', 'LOW', 'HIGH', 'LOW'] as const)
        : (['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH'] as const);
    for (const [x, a, b, c, d] of pivotWindows(swings, kinds)) {
      const XA = Math.abs(a!.price - x!.price);
      const XC = Math.abs(c!.price - x!.price);
      if (XA === 0 || XC === 0) continue;
      const AB_XA = Math.abs(b!.price - a!.price) / XA;
      const XC_XA = XC / XA;
      const XD_XC = Math.abs(d!.price - x!.price) / XC;
      if (!inRange(AB_XA, [0.382, 0.618], PCT_ERROR)) continue;
      if (!inRange(XC_XA, [1.272, 1.414], PCT_ERROR)) continue;
      if (!inRange(XD_XC, [0.786, 0.786], PCT_ERROR)) continue;
      // C must extend beyond A (the defining Cypher trait): higher high for bullish's C, lower low for bearish's C.
      if (direction === 'BULLISH' ? c!.price <= a!.price : c!.price >= a!.price) continue;
      out.push(
        makeHarmonicPattern(
          'cypher',
          'Carney/Oglesbee (cross-checked D58)',
          direction,
          [x!, a!, b!, c!, d!],
          XABCD_LABELS,
          {
            AB_XA,
            XC_XA,
            XD_XC,
          },
        ),
      );
    }
  }
  return out;
}

/**
 * Shark (Carney 2011), 5 points labelled 0-X-A-B-C - completes at C, not D (D78). Ratios used,
 * each matched by at least two independent sources (djoffrey/HarmonicPatterns code, FXOpen,
 * Algorush, LuxAlgo, HowToTrade - docs/arastirma/entegrasyon-bulgulari-2026-10-14.md):
 * AB = 1.13–1.618 × XA (so B goes beyond X), BC = 1.618–2.24 × AB, and C at 0.886–1.13 of 0X
 * measured from X. **No first-leg (XA/0X) ratio:** LuxAlgo and HowToTrade set none; djoffrey's
 * 0.5–0.886 is single-source and deliberately not applied (rule 8).
 */
export function detectShark(swings: readonly Swing[]): HarmonicPattern[] {
  const out: HarmonicPattern[] = [];
  for (const direction of ['BULLISH', 'BEARISH'] as const) {
    const kinds =
      direction === 'BULLISH'
        ? (['LOW', 'HIGH', 'LOW', 'HIGH', 'LOW'] as const)
        : (['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH'] as const);
    for (const [o, x, a, b, c] of pivotWindows(swings, kinds)) {
      const OX = Math.abs(x!.price - o!.price);
      const XA = Math.abs(a!.price - x!.price);
      const AB = Math.abs(b!.price - a!.price);
      if (OX === 0 || XA === 0 || AB === 0) continue;
      const AB_XA = AB / XA;
      const BC_AB = Math.abs(c!.price - b!.price) / AB;
      const XC_0X = Math.abs(c!.price - x!.price) / OX;
      // B must take out X: a higher high for the bullish pattern, a lower low for the bearish.
      if (direction === 'BULLISH' ? b!.price <= x!.price : b!.price >= x!.price) continue;
      if (!inRange(AB_XA, [1.13, 1.618], PCT_ERROR)) continue;
      if (!inRange(BC_AB, [1.618, 2.24], PCT_ERROR)) continue;
      if (!inRange(XC_0X, [0.886, 1.13], PCT_ERROR)) continue;
      out.push(
        makeHarmonicPattern(
          'shark',
          'Carney (cross-checked D78)',
          direction,
          [o!, x!, a!, b!, c!],
          SHARK_LABELS,
          { AB_XA, BC_AB, XC_0X },
        ),
      );
    }
  }
  return out;
}

/**
 * AB=CD is a 4-point pattern (no X) - the simplest harmonic shape, CD roughly equal in length to
 * AB (cross-checked D58).
 */
export function detectAbCd(swings: readonly Swing[]): HarmonicPattern[] {
  const out: HarmonicPattern[] = [];
  for (const direction of ['BULLISH', 'BEARISH'] as const) {
    const kinds =
      direction === 'BULLISH'
        ? (['HIGH', 'LOW', 'HIGH', 'LOW'] as const)
        : (['LOW', 'HIGH', 'LOW', 'HIGH'] as const);
    for (const [a, b, c, d] of pivotWindows(swings, kinds)) {
      const AB = Math.abs(b!.price - a!.price);
      const BC = Math.abs(c!.price - b!.price);
      const CD = Math.abs(d!.price - c!.price);
      if (AB === 0 || BC === 0) continue;
      const BC_AB = BC / AB;
      const CD_BC = CD / BC;
      const CD_AB = CD / AB;
      if (!inRange(BC_AB, [0.382, 0.886], PCT_ERROR)) continue;
      if (!inRange(CD_BC, [1.13, 2.618], PCT_ERROR)) continue;
      if (!inRange(CD_AB, [1.0, 1.0], PCT_ERROR)) continue;
      out.push(
        makeHarmonicPattern(
          'ab_cd',
          'common harmonic literature (cross-checked D58)',
          direction,
          [a!, b!, c!, d!],
          ['A', 'B', 'C', 'D'],
          { BC_AB, CD_BC, CD_AB },
        ),
      );
    }
  }
  return out;
}
