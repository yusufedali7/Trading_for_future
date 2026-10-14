import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App } from '../src/App';

/** Backtests run in these tests; allow for a busy machine when the whole suite runs. */
const waitLong = <T,>(fn: () => T | Promise<T>) => vi.waitFor(fn, { timeout: 8000 });
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { createMemoryResearchRepo, createMemoryStrategyRepo } from '../src/storage/strategy-repo';

// SYNTHETIC: six hours of wave-shaped 1m bars from Tue 2026-01-06 18:00Z (30-minute cycle).
const rows = Array.from({ length: 360 }, (_, i) => {
  const mid = 1.1 + 0.001 * Math.sin((2 * Math.PI * i) / 30) + ((i * 13) % 7) / 100_000;
  const r = (x: number) => Math.round(x * 1e5) / 1e5;
  return {
    t: Date.parse('2026-01-06T18:00:00Z') + i * 60_000,
    o: r(mid),
    h: r(mid + 0.0003),
    l: r(mid - 0.0003),
    c: r(mid + 0.0001),
  };
});

let latest: ChartViewProps | null = null;
function FakeChart(p: ChartViewProps) {
  latest = p;
  return <span data-testid="count">{p.candles.length}</span>;
}

async function setup() {
  const series = seriesFromRows(rows, false);
  const repo = createMemoryRepo();
  await repo.saveDataset(
    {
      id: 'ds',
      instrument: 'EURUSD',
      baseTimeframe: '1m',
      contentHash: series.contentHash,
      source: { name: 'SYNTHETIC', importedAt: 1 },
      range: { from: rows[0]!.t, to: rows[rows.length - 1]!.t },
    } as DataSetMeta,
    series,
  );
  const strategies = createMemoryStrategyRepo();
  const research = createMemoryResearchRepo();
  let id = 0;
  let clock = 1_000;
  render(
    <App
      repo={repo}
      prefs={createMemoryPrefsRepo()}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={createMemoryJournalRepo()}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(repo)}
      strategyRepo={strategies}
      researchRepo={research}
      ChartComponent={FakeChart}
      now={() => (clock += 1_000)}
      newId={() => `id-${++id}`}
    />,
  );
  await waitLong(() => expect(screen.getByTestId('count')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Strateji' }));
  await waitLong(() => expect(screen.getByRole('button', { name: 'Yeni strateji' })).toBeTruthy());
  return { strategies, research };
}

const builder = () => within(screen.getByRole('form', { name: 'Kurallar' }));

/** A 1m long strategy: after a swing low, buy at market, 5 pip stop, 2R. */
async function createSwingStrategy() {
  fireEvent.click(screen.getByRole('button', { name: 'Yeni strateji' }));
  const b = builder();
  fireEvent.change(b.getByLabelText('Ad'), { target: { value: 'Dip alımı (deneme)' } });
  fireEvent.change(b.getByLabelText('Zaman dilimi'), { target: { value: '1m' } });
  fireEvent.change(b.getByLabelText('Olay'), { target: { value: 'SWING' } });
  fireEvent.change(b.getByLabelText('Swing'), { target: { value: 'LOW' } });
  // The default stop refers to "sweep.extreme", which no longer exists.
  expect(b.getByRole('alert').textContent).toMatch(/Referans/);
  fireEvent.change(b.getByLabelText('Stop'), { target: { value: 'FIXED_PIPS' } });
  fireEvent.change(b.getByLabelText('Pip'), { target: { value: '5' } });
  expect(b.queryByRole('alert')).toBeNull();
  fireEvent.click(b.getByRole('button', { name: 'Versiyonu kaydet' }));
  await waitLong(() => expect(screen.getByRole('region', { name: 'v1' })).toBeTruthy());
}

describe('strategy page', () => {
  it('creates a strategy as an immutable version with a readable summary and status history', async () => {
    const { strategies } = await setup();
    await createSwingStrategy();
    const v1 = within(screen.getByRole('region', { name: 'v1' }));
    expect(v1.getByText('EURUSD · 1m · Long · her saatte')).toBeTruthy();
    expect(v1.getByText('1. swing: Swing, dip')).toBeTruthy();
    expect(v1.getByText(/Giriş: piyasa · Stop: 5 pip · Hedef: 2R · Risk %0,5/)).toBeTruthy();

    fireEvent.change(v1.getByLabelText('Durum'), { target: { value: 'TESTING' } });
    await waitLong(async () =>
      expect((await strategies.listVersions('id-1'))[0]!.status).toBe('TESTING'),
    );

    // A new version starts from the old rules; the old one stays as it was.
    fireEvent.click(v1.getByRole('button', { name: /Yeni versiyon/ }));
    fireEvent.change(builder().getByLabelText('R'), { target: { value: '3' } });
    fireEvent.click(builder().getByRole('button', { name: 'Versiyonu kaydet' }));
    await waitLong(() => expect(screen.getByRole('region', { name: 'v2' })).toBeTruthy());
    const versions = await strategies.listVersions('id-1');
    expect(versions.map((v) => [v.version, v.spec.target])).toEqual([
      [1, { type: 'R_MULTIPLE', r: 2 }],
      [2, { type: 'R_MULTIPLE', r: 3 }],
    ]);
  });

  it('runs a backtest, stores the run with its record and shows honesty indicators', async () => {
    const { research } = await setup();
    await createSwingStrategy();
    fireEvent.click(screen.getByRole('button', { name: 'Backtest çalıştır' }));
    await waitLong(() =>
      expect(screen.getByRole('note', { name: 'Dürüstlük göstergeleri' })).toBeTruthy(),
    );
    const [stored] = await research.listRuns();
    expect(stored!.run).toMatchObject({
      strategy: { id: 'id-1', name: 'Dip alımı (deneme)', version: 1 },
      data: { datasetId: 'ds', instrument: 'EURUSD', timeframe: '1m', sourceName: 'SYNTHETIC' },
      split: { role: 'FULL', boundary: null },
      ambiguity: 'STOP_FIRST',
      inSampleTrial: null,
    });
    expect(stored!.result.trades.length).toBeGreaterThan(0);
    const honesty = within(screen.getByRole('note', { name: 'Dürüstlük göstergeleri' }));
    expect(honesty.getByText(/30’dan az/)).toBeTruthy();
    expect(screen.getByText(/Maliyetsiz/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bakiye eğrisi (USD)' })).toBeTruthy();
  });

  it('explains report terms in place and opens them in the glossary (D71)', async () => {
    await setup();
    await createSwingStrategy();
    fireEvent.click(screen.getByRole('button', { name: 'Backtest çalıştır' }));
    await waitLong(() =>
      expect(screen.getByRole('note', { name: 'Dürüstlük göstergeleri' })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kazanma oranı' }));
    const pop = screen.getByRole('dialog', { name: 'Kazanma oranı ve beklenen değer' });
    fireEvent.click(within(pop).getByRole('button', { name: 'Sözlükte aç' }));
    expect(screen.getByRole('button', { name: 'Öğren' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Sözlük' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const selected = document.querySelector('[data-selected="true"]') as HTMLElement;
    expect(within(selected).getByRole('heading').textContent).toBe(
      'Kazanma oranı ve beklenen değer',
    );
  });

  it('shows the setups of a version on the chart', async () => {
    await setup();
    await createSwingStrategy();
    fireEvent.click(screen.getByRole('button', { name: 'Kurulumları grafikte göster' }));
    await waitLong(() => expect(screen.getByRole('status').textContent).toMatch(/Dip alımı/));
    expect(latest!.timeframe).toBe('1m');
    expect(latest!.setups!.signalBarsAt.length).toBeGreaterThan(0);
    expect(latest!.setups!.long).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Gizle' }));
    expect(latest!.setups).toBeNull();
  });
});
