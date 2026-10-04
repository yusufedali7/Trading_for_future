import { describe, expect, it } from 'vitest';
import type { BrokerBar } from '@trw/engine';
import {
  createMt5Client,
  FeedError,
  INITIAL_MINUTES,
  mt5DatasetId,
  syncMt5Dataset,
  type BridgeStatus,
  type Mt5Client,
} from '../src/features/paper/mt5-feed';
import { createMemoryRepo } from '../src/storage/memory-repo';

const H = 3_600_000;
const t = (iso: string) => Date.parse(iso);

/** SYNTHETIC bridge: a broker at UTC+2 with 1m bars ending one minute before `nowIso`. */
function fakeClient(nowIso: string, opts: { tickAgeSec?: number } = {}) {
  const now = t(nowIso);
  const calls: number[] = [];
  const client: Mt5Client = {
    status: async (symbol): Promise<BridgeStatus> => ({
      bridge: '1',
      account: { server: 'MetaQuotes-Demo', mode: 'DEMO', currency: 'USD' },
      symbol,
      lastTickServerSec: (now + 2 * H) / 1000 - (opts.tickAgeSec ?? 3),
      utcNowMs: now,
    }),
    rates: async (_symbol, count): Promise<BrokerBar[]> => {
      calls.push(count);
      const lastOpen = Math.floor(now / 60_000) * 60_000 - 60_000;
      return Array.from({ length: Math.min(count, 120) }, (_, i) => {
        const tUtc = lastOpen - (Math.min(count, 120) - 1 - i) * 60_000;
        return { t: (tUtc + 2 * H) / 1000, o: 1.1, h: 1.1003, l: 1.0997, c: 1.1001, v: 4 };
      });
    },
  };
  return { client, calls };
}

describe('MT5 feed', () => {
  it('stores the broker bars in their own dataset, converted to UTC', async () => {
    const repo = createMemoryRepo();
    const { client, calls } = fakeClient('2026-01-06T10:00:30Z');
    const res = await syncMt5Dataset({ client, repo, symbol: 'EURUSD', now: () => 7 });
    expect(calls).toEqual([INITIAL_MINUTES]);
    expect(res).toMatchObject({ added: 120, revised: 0, offsetMs: 2 * H, dstWarning: false });
    expect(res.meta).toMatchObject({
      id: mt5DatasetId('MetaQuotes-Demo', 'EURUSD'),
      instrument: 'EURUSD',
      source: { name: 'MT5: MetaQuotes-Demo', importedAt: 7 },
      range: { from: t('2026-01-06T08:00:00Z'), to: t('2026-01-06T09:59:00Z') },
      candleCount: 120,
      demo: false,
    });
    expect((await repo.listDatasets()).map((d) => d.id)).toEqual(['mt5:MetaQuotes-Demo:EURUSD']);
  });

  it('asks only for the minutes since the last stored bar next time', async () => {
    const repo = createMemoryRepo();
    await syncMt5Dataset({
      client: fakeClient('2026-01-06T10:00:30Z').client,
      repo,
      symbol: 'EURUSD',
      now: () => 1,
    });
    const later = fakeClient('2026-01-06T10:10:30Z');
    const res = await syncMt5Dataset({
      client: later.client,
      repo,
      symbol: 'EURUSD',
      now: () => 2,
    });
    expect(later.calls).toEqual([17]); // 11.5 minutes since 09:59 → 12, plus 5 for safety
    expect(res.added).toBe(10);
    expect(res.meta.range.to).toBe(t('2026-01-06T10:09:00Z'));
  });

  it('refuses to convert times it cannot measure', async () => {
    const repo = createMemoryRepo();
    await expect(
      syncMt5Dataset({
        client: fakeClient('2026-01-10T12:00:00Z').client,
        repo,
        symbol: 'EURUSD',
        now: () => 1,
      }),
    ).rejects.toMatchObject({ problem: 'MARKET_CLOSED' });
    await expect(
      syncMt5Dataset({
        client: fakeClient('2026-01-06T10:00:30Z', { tickAgeSec: 400 }).client,
        repo,
        symbol: 'EURUSD',
        now: () => 1,
      }),
    ).rejects.toBeInstanceOf(FeedError);
    expect(await repo.listDatasets()).toEqual([]);
  });

  it('maps bridge failures to problems', async () => {
    const down = createMt5Client('http://bridge', async () => {
      throw new TypeError('fetch failed');
    });
    await expect(down.status('EURUSD')).rejects.toMatchObject({ problem: 'BRIDGE_DOWN' });
    const real = createMt5Client(
      'http://bridge',
      async () => new Response(JSON.stringify({ error: 'NOT_DEMO' }), { status: 403 }),
    );
    await expect(real.status('EURUSD')).rejects.toMatchObject({ problem: 'NOT_DEMO' });
  });
});
