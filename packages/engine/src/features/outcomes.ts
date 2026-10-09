import type { UtcMs } from '../core/types';
import type { Bars } from './bars';
import type { FeatureSet } from './compute';
import type { SmcSet } from './smc';
import type { Detection } from './types';

/**
 * What happened after a candidate (concept library, D40). Our own, versioned yardstick — not an
 * official ICT/SMC rule: a candidate "failed" when a bar within `horizonBars` after its
 * confirmation closes beyond one price; it "held" when all those bars closed without that.
 */
export const OUTCOME_VERSION = 'outcome-v1';

export interface OutcomeParams {
  horizonBars: number;
}

export const OUTCOME_DEFAULTS: OutcomeParams = { horizonBars: 12 };

export type OutcomeStatus = 'HELD' | 'FAILED' | 'PENDING';

export interface CandidateOutcome {
  id: string;
  status: OutcomeStatus;
  /** Close time of the first bar that closed beyond the price. */
  failedAt: UtcMs | null;
  /** When the outcome became known; null while pending. */
  resolvedAt: UtcMs | null;
}

/**
 * Concepts wired into `featureOutcomes`. The 4 `FeatureSet` ones, plus the 4 SMC concepts that
 * have a single direction + invalidation price (D59 - the same 4 that became `ORDER_BLOCK`/
 * `IFVG`/`BREAKER`/`OTE` `EventStep`s); the other 4 SMC concepts (Displacement, Equal Levels,
 * Premium/Discount, Candidate S/R) have no such price and so no outcome measurement at all, like
 * `PERIOD_LEVELS`/`SESSIONS` in the concept library.
 */
export type OutcomeConcept =
  | 'SWING'
  | 'FVG'
  | 'STRUCTURE_BREAK'
  | 'LIQUIDITY_SWEEP'
  | 'ORDER_BLOCK'
  | 'IFVG'
  | 'BREAKER'
  | 'OTE';

/** The price a close must not go beyond, and on which side "beyond" is. */
function failureLine(d: Detection): { price: number; below: boolean } {
  switch (d.type) {
    case 'SWING':
      return { price: d.price, below: d.kind === 'LOW' };
    case 'FVG':
      return d.direction === 'BULLISH'
        ? { price: d.bottom, below: true }
        : { price: d.top, below: false };
    case 'STRUCTURE_BREAK':
      return { price: d.level, below: d.direction === 'BULLISH' };
    case 'LIQUIDITY_SWEEP':
      return { price: d.extreme, below: d.direction === 'BULLISH' };
    case 'ORDER_BLOCK':
    case 'IFVG':
    case 'BREAKER':
    case 'OTE':
      return d.direction === 'BULLISH'
        ? { price: d.bottom, below: true }
        : { price: d.top, below: false };
  }
}

/** Uses only bars after the confirmation bar, so it never looks past `b` (rule 3). */
export function candidateOutcome(
  b: Bars,
  d: Detection,
  p: OutcomeParams = OUTCOME_DEFAULTS,
): CandidateOutcome {
  const { price, below } = failureLine(d);
  const last = d.confirmedIndex + p.horizonBars;
  for (let i = d.confirmedIndex + 1; i <= Math.min(last, b.length - 1); i++) {
    const c = b.c[i]!;
    if (below ? c < price : c > price) {
      return { id: d.id, status: 'FAILED', failedAt: b.end[i]!, resolvedAt: b.end[i]! };
    }
  }
  if (last <= b.length - 1) {
    return { id: d.id, status: 'HELD', failedAt: null, resolvedAt: b.end[last]! };
  }
  return { id: d.id, status: 'PENDING', failedAt: null, resolvedAt: null };
}

export function featureOutcomes(
  b: Bars,
  f: Pick<FeatureSet, 'swings' | 'fvgs' | 'breaks' | 'sweeps'>,
  p: OutcomeParams = OUTCOME_DEFAULTS,
  smc?: Pick<SmcSet, 'orderBlocks' | 'ifvgs' | 'breakers' | 'ote'>,
): Record<OutcomeConcept, CandidateOutcome[]> {
  const all = (ds: readonly Detection[]) => ds.map((d) => candidateOutcome(b, d, p));
  return {
    SWING: all(f.swings),
    FVG: all(f.fvgs),
    STRUCTURE_BREAK: all(f.breaks),
    LIQUIDITY_SWEEP: all(f.sweeps),
    ORDER_BLOCK: all(smc?.orderBlocks ?? []),
    IFVG: all(smc?.ifvgs ?? []),
    BREAKER: all(smc?.breakers ?? []),
    OTE: all(smc?.ote ?? []),
  };
}

export interface OutcomeSummary {
  total: number;
  held: number;
  failed: number;
  pending: number;
  /** Failed share among decided candidates; a measurement on this data, not a probability. */
  failureRate: number | null;
  /** Fewer than 30 decided candidates. */
  lowSample: boolean;
}

export function summarizeOutcomes(list: readonly CandidateOutcome[]): OutcomeSummary {
  const count = (s: OutcomeStatus) => list.filter((o) => o.status === s).length;
  const held = count('HELD');
  const failed = count('FAILED');
  const decided = held + failed;
  return {
    total: list.length,
    held,
    failed,
    pending: count('PENDING'),
    failureRate: decided === 0 ? null : failed / decided,
    lowSample: decided < 30,
  };
}
