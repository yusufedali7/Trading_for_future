import type { DataSetMeta, LotRules } from '@trw/engine';
import type { CandleSource } from '../../compute/candle-source';
import type { ResearchRepo, StoredDraft, StrategyRepo } from '../../storage/strategy-repo';

const LOTS: LotRules = { lotStep: 0.01, minLot: 0.01 };

/**
 * After an MT5 sync lands new bars for `meta.instrument` (M11, D70): recompute signal drafts for
 * every strategy version currently watched on that instrument, and upsert them. Recomputes from
 * each watch's `watchedSince` every time rather than tracking "last seen" - `StoredDraft.id` is
 * deterministic per setup, so this is an idempotent upsert, not a duplicate, and stays correct if
 * a sync is ever missed or retried (same reasoning as the backtest/setups layer recomputing the
 * whole dataset rather than keeping incremental state).
 */
export async function refreshDrafts(p: {
  meta: DataSetMeta;
  strategies: StrategyRepo;
  research: ResearchRepo;
  source: CandleSource;
  now: () => number;
}): Promise<void> {
  const watched = await p.research.listWatched();
  const active = watched.filter((w) => w.stoppedAt === null && w.instrument === p.meta.instrument);
  if (active.length === 0) return;

  const allStrategies = await p.strategies.listStrategies();
  const nameById = new Map(allStrategies.map((s) => [s.id, s.name]));
  const toSave: StoredDraft[] = [];
  const savedAt = p.now();

  for (const w of active) {
    const versions = await p.strategies.listVersions(w.strategyId);
    const version = versions.find((v) => v.version === w.strategyVersion);
    if (!version) continue; // deleted/renamed strategy - nothing to evaluate
    const { drafts } = await p.source.draftsSince(
      p.meta,
      version.spec,
      w.strategyId,
      w.strategyVersion,
      w.watchedSince,
      w.startEquity,
      LOTS,
    );
    for (const draft of drafts) {
      toSave.push({
        id: draft.id,
        strategyName: nameById.get(w.strategyId) ?? w.strategyId,
        draft,
        savedAt,
      });
    }
  }
  if (toSave.length > 0) await p.research.saveDrafts(toSave);
}
