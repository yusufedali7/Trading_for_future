import { describe, expect, it } from 'vitest';
import {
  defaultSpec,
  newVersion,
  seriesFromRows,
  type DataSetMeta,
  type Strategy,
} from '@trw/engine';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { refreshDrafts } from '../src/features/live/refresh-drafts';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { createMemoryResearchRepo, createMemoryStrategyRepo } from '../src/storage/strategy-repo';

// SYNTHETIC: two hours of 1m bars with regular swings.
const rows = Array.from({ length: 120 }, (_, i) => {
  const mid = 1.1 + ((i * 7) % 11) / 10_000;
  return {
    t: Date.parse('2026-01-06T13:00:00Z') + i * 60_000,
    o: mid,
    h: mid + 0.0002,
    l: mid - 0.0003,
    c: mid + 0.0001,
    v: 1,
  };
});

async function setup() {
  const series = seriesFromRows(rows, true);
  const meta = {
    id: 'd',
    instrument: 'EURUSD',
    baseTimeframe: '1m',
    contentHash: series.contentHash,
  } as DataSetMeta;
  const market = createMemoryRepo();
  await market.saveDataset(meta, series);
  const strategies = createMemoryStrategyRepo();
  const research = createMemoryResearchRepo();
  const base: Strategy = {
    id: 's1',
    name: 'Dip alımı',
    description: '',
    latestVersion: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  const spec = {
    ...defaultSpec(),
    timeframe: '1m' as const,
    steps: [{ id: 'low', type: 'SWING' as const, kind: 'LOW' as const }],
    stop: { type: 'FIXED_PIPS' as const, pips: 3 },
  };
  await strategies.createStrategy(base, newVersion(base, spec, '', 1));
  await research.watch({
    id: 's1:1',
    strategyId: 's1',
    strategyVersion: 1,
    instrument: 'EURUSD',
    watchedSince: 0,
    stoppedAt: null,
    startEquity: 10_000,
    createdAt: 1,
  });
  const p = {
    meta,
    strategies,
    research,
    source: createInProcessCandleSource(market),
    now: () => 5,
  };
  return { p, research };
}

describe('refreshDrafts (D76: which drafts are new)', () => {
  it('reports every draft as new on the first sync and none on a repeated sync', async () => {
    const { p, research } = await setup();
    const first = await refreshDrafts(p);
    const stored = await research.listDrafts();
    expect(stored.length).toBeGreaterThan(0);
    expect(first.fresh.map((d) => d.id).sort()).toEqual(stored.map((d) => d.id).sort());

    const again = await refreshDrafts(p);
    expect(again.fresh).toEqual([]);
    expect(await research.listDrafts()).toHaveLength(stored.length);
  });
});
