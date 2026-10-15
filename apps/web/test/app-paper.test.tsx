import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { defaultSpec, newVersion, type BrokerBar, type Strategy } from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import type { Mt5Client } from '../src/features/paper/mt5-feed';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { createMemoryResearchRepo, createMemoryStrategyRepo } from '../src/storage/strategy-repo';
import { waitLong } from './helpers/wait';

const H = 3_600_000;
const MIN = 60_000;
const t = (iso: string) => Date.parse(iso);

/** SYNTHETIC broker at UTC+2: wave-shaped 1m bars (30-minute cycle) up to the current minute. */
function fakeBroker(clock: { now: number }): Mt5Client {
  const price = (tUtc: number) => {
    const i = (tUtc - t('2026-01-06T00:00:00Z')) / MIN;
    const r = (x: number) => Math.round(x * 1e5) / 1e5;
    const mid = 1.1 + 0.001 * Math.sin((2 * Math.PI * i) / 30) + ((i * 13) % 7) / 100_000;
    return { o: r(mid), h: r(mid + 0.0003), l: r(mid - 0.0003), c: r(mid + 0.0001) };
  };
  return {
    status: async (symbol) => ({
      bridge: '1',
      account: { server: 'MetaQuotes-Demo', mode: 'DEMO', currency: 'USD' },
      symbol,
      lastTickServerSec: (clock.now + 2 * H) / 1000 - 2,
      utcNowMs: clock.now,
    }),
    rates: async (_s, count): Promise<BrokerBar[]> => {
      const lastOpen = Math.floor(clock.now / MIN) * MIN - MIN;
      const n = Math.min(count, 600);
      return Array.from({ length: n }, (_, k) => {
        const tUtc = lastOpen - (n - 1 - k) * MIN;
        return { t: (tUtc + 2 * H) / 1000, ...price(tUtc), v: 1 };
      });
    },
  };
}

function FakeChart(p: ChartViewProps) {
  return <span data-testid="count">{p.candles.length}</span>;
}

async function setup() {
  const repo = createMemoryRepo();
  const strategies = createMemoryStrategyRepo();
  const s: Strategy = {
    id: 's1',
    name: 'Dip alımı',
    description: '',
    latestVersion: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  await strategies.createStrategy(
    s,
    newVersion(
      s,
      {
        ...defaultSpec(),
        timeframe: '1m',
        steps: [{ id: 'low', type: 'SWING', kind: 'LOW' }],
        stop: { type: 'FIXED_PIPS', pips: 5 },
      },
      '',
      1,
    ),
  );
  const research = createMemoryResearchRepo();
  const prefs = createMemoryPrefsRepo();
  const clock = { now: t('2026-01-06T10:00:30Z') };
  let id = 0;
  render(
    <App
      repo={repo}
      prefs={prefs}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={createMemoryJournalRepo()}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(repo)}
      strategyRepo={strategies}
      researchRepo={research}
      mt5Client={fakeBroker(clock)}
      ChartComponent={FakeChart}
      now={() => clock.now}
      newId={() => `id-${++id}`}
    />,
  );
  // No dataset yet: the empty state shows, but the view switch is there.
  fireEvent.click(await screen.findByRole('button', { name: 'Paper' }));
  return { repo, research, clock, prefs };
}

describe('paper trading with the MT5 bridge', () => {
  it('pulls broker data into its own dataset and runs a session forward only', async () => {
    const { repo, research, clock } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Şimdi güncelle' }));
    await waitLong(() =>
      expect(screen.getByRole('status').textContent).toMatch(/MetaQuotes-Demo \(DEMO\).*UTC\+2:00/),
    );
    expect((await repo.listDatasets()).map((d) => d.source.name)).toEqual(['MT5: MetaQuotes-Demo']);

    const form = within(await screen.findByRole('form', { name: 'Yeni paper oturumu' }));
    fireEvent.click(form.getByRole('button', { name: /Oturumu başlat/ }));
    await waitLong(async () => expect(await research.listPaperSessions()).toHaveLength(1));
    const [session] = await research.listPaperSessions();
    expect(session).toMatchObject({
      startedAt: t('2026-01-06T10:00:30Z'),
      stoppedAt: null,
      strategyVersion: 1,
    });
    // Nothing yet: no setup can be confirmed after the start without new data.
    await screen.findByText('Henüz işlem yok.');

    clock.now = t('2026-01-06T12:00:30Z');
    fireEvent.click(screen.getByRole('button', { name: 'Şimdi güncelle' }));
    const card = within(await screen.findByRole('region', { name: 'Dip alımı v1' }));
    await waitLong(() => expect(card.getByText(/\d+ işlem ·/)).toBeTruthy());
    // Every trade was signalled after the start (10:00:30Z = 13:00:30 Istanbul).
    const times = card
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td')!.textContent!);
    expect(times.length).toBeGreaterThan(0);
    expect(times.every((x) => x > '2026-01-06 13:00')).toBe(true);

    fireEvent.click(card.getByRole('button', { name: 'Durdur' }));
    await waitLong(async () =>
      expect((await research.listPaperSessions())[0]!.stoppedAt).toBe(clock.now),
    );
  });

  it('keeps updating every minute on other views and remembers the choice', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const { repo, clock, prefs } = await setup();
      fireEvent.click(screen.getByRole('checkbox', { name: /otomatik güncelle/ }));
      // Turning it on syncs at once, not a minute later.
      await waitLong(async () => expect(await repo.listDatasets()).toHaveLength(1));
      await waitLong(async () => expect((await prefs.load()).paperFeed.auto).toBe(true));
      const endBefore = (await repo.listDatasets())[0]!.range.to;

      fireEvent.click(screen.getByRole('button', { name: 'Strateji' }));
      expect(screen.getByText('● MT5 canlı')).toBeTruthy();
      clock.now += 5 * MIN;
      await vi.advanceTimersByTimeAsync(60_000);
      await waitLong(async () =>
        expect((await repo.listDatasets())[0]!.range.to).toBe(endBefore + 5 * MIN),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Paper' }));
      expect(
        (screen.getByRole('checkbox', { name: /otomatik güncelle/ }) as HTMLInputElement).checked,
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains why it cannot convert times when the market is closed', async () => {
    const { clock } = await setup();
    clock.now = t('2026-01-10T12:00:00Z'); // Saturday
    fireEvent.click(screen.getByRole('button', { name: 'Şimdi güncelle' }));
    await waitLong(() => expect(screen.getByRole('alert').textContent).toMatch(/Piyasa kapalı/));
  });
});
