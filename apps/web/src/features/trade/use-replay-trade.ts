import { useEffect, useRef, useState } from 'react';
import {
  buildOrder,
  getInstrument,
  timeframeMs,
  type AmbiguityRule,
  type CostModel,
  type DataSetMeta,
  type DraftProblem,
  type OrderDraft,
  type ReplayTrade,
  type Timeframe,
  type TradeStatus,
  type UtcMs,
} from '@trw/engine';
import type { CandleSource } from '../../compute/candle-source';
import type { JournalRepo } from '../../storage/journal-repo';

const AMBIGUITY: AmbiguityRule = 'STOP_FIRST';

/** The trade is settled; the cursor no longer changes it. */
export const isFinal = (s: TradeStatus) => s !== 'PENDING' && s !== 'OPEN';

export interface UseReplayTradeArgs {
  source: CandleSource;
  repo: JournalRepo;
  active: DataSetMeta | null;
  timeframe: Timeframe;
  cursor: UtcMs | null;
  now: () => number;
  newId: () => string;
}

/**
 * One manual replay trade at a time. The engine simulator decides fills and exits from the base
 * bars known at the cursor; the trade is re-simulated whenever the cursor moves and stored when
 * its status changes.
 */
export function useReplayTrade({
  source,
  repo,
  active,
  timeframe,
  cursor,
  now,
  newId,
}: UseReplayTradeArgs) {
  const [trade, setTrade] = useState<ReplayTrade | null>(null);
  const tradeRef = useRef(trade);
  tradeRef.current = trade;
  const requestRef = useRef(0);

  useEffect(() => {
    const t = tradeRef.current;
    if (!t || !active || cursor === null || isFinal(t.result.status)) return;
    const request = ++requestRef.current;
    void source
      .simulate(active, t.order, {
        cutoff: cursor,
        costs: t.costs,
        ambiguity: t.ambiguity,
        ...(t.closeAt === null ? {} : { closeAt: t.closeAt }),
      })
      .then((result) => {
        if (request !== requestRef.current) return;
        const next = { ...t, result, updatedAt: now() };
        setTrade(next);
        if (result.status !== t.result.status) void repo.saveTrade(next);
      });
  }, [source, repo, active, cursor, trade?.id, trade?.closeAt]);

  // Another dataset: the trade belongs to the old one.
  useEffect(() => setTrade(null), [active?.id]);

  /** Places an order at the cursor; returns what is wrong with the draft, or null. */
  const place = async (
    draft: OrderDraft,
    costs: CostModel,
    lastClose: number,
  ): Promise<DraftProblem | null> => {
    if (!active || cursor === null) return null;
    const built = buildOrder(getInstrument(active.instrument), draft, {
      placedAt: cursor,
      lastClose,
      barMs: timeframeMs(timeframe),
    });
    if ('problem' in built) return built.problem;
    const result = await source.simulate(active, built.order, {
      cutoff: cursor,
      costs,
      ambiguity: AMBIGUITY,
    });
    const at = now();
    const t: ReplayTrade = {
      id: newId(),
      instrument: active.instrument,
      datasetId: active.id,
      timeframe,
      order: built.order,
      costs,
      ambiguity: AMBIGUITY,
      closeAt: null,
      result,
      journalId: null,
      createdAt: at,
      updatedAt: at,
    };
    setTrade(t);
    await repo.saveTrade(t);
    return null;
  };

  return {
    trade,
    /** A pending or open trade exists: the cursor may only move forward. */
    busy: trade !== null && !isFinal(trade.result.status),
    place,
    /** Manual close (open trade) or cancel (pending order) at the cursor. */
    close: () => {
      if (trade && cursor !== null && !isFinal(trade.result.status))
        setTrade({ ...trade, closeAt: cursor });
    },
    /** Forget the settled trade and show the order form again. */
    dismiss: () => setTrade(null),
    /** Links the settled trade to its journal entry. */
    attachJournal: async (journalId: string) => {
      if (!trade) return;
      const next = { ...trade, journalId, updatedAt: now() };
      setTrade(next);
      await repo.saveTrade(next);
    },
  };
}
