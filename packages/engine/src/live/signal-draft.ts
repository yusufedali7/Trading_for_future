import { timeframeMs } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type { Direction, TradeOrder } from '../execution/trade-sim';
import type { Instrument } from '../instruments/registry';
import { orderFor } from '../backtest/run';
import { positionSize, type LotRules } from '../risk/sizing';
import type { Setup, StepMatch } from '../strategy/matcher';
import { STRATEGY_STATUSES, type StrategySpec, type StrategyStatus } from '../strategy/schema';

/**
 * M11 (D68): "what would this strategy tell me right now" - not a trade, not a backtest result.
 * The app always leaves the actual order to the user (CLAUDE.md rule 7, and the assistant's own
 * line independent of it); this module only turns an already-found `Setup` into display-ready
 * numbers, reusing the exact same math the backtest already uses (`orderFor`, `positionSize`) so a
 * live draft and a backtested trade are never computed two different ways.
 *
 * Scope of this slice: pure computation only (one setup -> one draft, or many drafts -> their
 * conflicts). Deliberately NOT built here: a persistent watch-list, wiring to the live/paper MT5
 * feed to produce new setups as bars close, webhook delivery, and the UI - each is its own
 * follow-up piece, same discipline as D62/D66's "measurement core first" pattern.
 */

/** Default minimum status to watch (D68's placeholder for AI-BOT-TASLAK.md's open question 1 -
 * the user is researching the right threshold; change this one constant when they're done). */
export const MIN_WATCHABLE_STATUS: StrategyStatus = 'TESTING';

export function isWatchable(status: StrategyStatus): boolean {
  return STRATEGY_STATUSES.indexOf(status) >= STRATEGY_STATUSES.indexOf(MIN_WATCHABLE_STATUS);
}

export type DraftSkipReason = 'INVALID_ORDER' | 'CROSS_PAIR' | 'SIZE_TOO_SMALL';

export interface SignalDraft {
  id: string;
  strategyId: string;
  strategyVersion: number;
  instrument: string;
  direction: Direction;
  setupId: string;
  /** Which steps matched and when, for an "sweep ✓, MSS ✓, FVG ✓" style display. */
  conditions: readonly StepMatch[];
  order: TradeOrder;
  lots: number;
  riskAmount: number;
  /** Known at (the setup's signal time). */
  createdAt: UtcMs;
  /**
   * When this draft stops being worth acting on. For a pending LIMIT/STOP entry this is the
   * order's own `expiresAt`; a MARKET entry's `expiresAt` is `null` (backtest fills it
   * immediately, so "expiry" doesn't apply there) - for a live draft that's reinterpreted as "one
   * bar to act on it", since after that bar closes the price the draft was computed from is gone.
   */
  expiresAt: UtcMs;
}

/**
 * One setup -> one signal draft, or the reason it can't become one (mirrors the backtest loop's
 * own skip reasons, D32, so a live draft and a backtest trade apply identical honesty checks).
 */
export function draftFor(
  spec: StrategySpec,
  strategyId: string,
  strategyVersion: number,
  inst: Instrument,
  s: Setup,
  lastClose: number,
  equity: number,
  lots: LotRules,
  atrAtSignal: number | null = null,
): { draft: SignalDraft } | { skipped: DraftSkipReason } {
  const order = orderFor(spec, inst, s, lastClose, atrAtSignal);
  if (!order) return { skipped: 'INVALID_ORDER' };
  const plannedEntry = order.type === 'MARKET' ? order.referencePrice : order.price!;
  const size = positionSize(
    inst,
    equity,
    spec.risk.percentPerTrade,
    plannedEntry,
    order.stop,
    lots,
  );
  if (!size.ok) return { skipped: size.reason === 'CROSS_PAIR' ? 'CROSS_PAIR' : 'SIZE_TOO_SMALL' };
  return {
    draft: {
      id: `${strategyId}:${strategyVersion}:${s.id}`,
      strategyId,
      strategyVersion,
      instrument: spec.instrument,
      direction: spec.direction,
      setupId: s.id,
      conditions: s.steps,
      order,
      lots: size.lots,
      riskAmount: size.riskAmount,
      createdAt: s.signalAt,
      expiresAt: order.expiresAt ?? s.signalAt + timeframeMs(spec.timeframe),
    },
  };
}

export interface DraftConflict {
  a: string;
  b: string;
  instrument: string;
}

/**
 * Same instrument, opposite direction, both still active at `now` - flagged, never hidden or
 * ranked (CLAUDE.md rule 6: the system doesn't decide which strategy is "right").
 */
export function findConflicts(
  drafts: readonly SignalDraft[],
  now: UtcMs,
): readonly DraftConflict[] {
  const active = drafts.filter((d) => d.expiresAt > now);
  const out: DraftConflict[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.instrument === b.instrument && a.direction !== b.direction) {
        out.push({ a: a.id, b: b.id, instrument: a.instrument });
      }
    }
  }
  return out;
}
