import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App, type AppProps } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';

// SYNTHETIC: six hours of 1m bars from Tue 2026-01-06 18:00Z (24 bars at 15m).
const rows = Array.from({ length: 360 }, (_, i) => {
  const mid = 1.1 + ((i * 13) % 29) / 10_000;
  return {
    t: Date.parse('2026-01-06T18:00:00Z') + i * 60_000,
    o: mid,
    h: mid + 0.0004,
    l: mid - 0.0004,
    c: mid + 0.0001,
    v: 1,
  };
});

function FakeChart(p: ChartViewProps) {
  const last = p.candles[p.candles.length - 1];
  return (
    <div data-testid="chart">
      <span data-testid="count">{p.candles.length}</span>
      <span data-testid="last">{last ? new Date(last.t).toISOString() : '-'}</span>
    </div>
  );
}

async function setup() {
  const series = seriesFromRows(rows, true);
  const repo = createMemoryRepo();
  const meta = {
    id: 'ds',
    instrument: 'EURUSD',
    baseTimeframe: '1m',
    contentHash: series.contentHash,
    source: { name: 'SYNTHETIC', importedAt: 1 },
    range: { from: rows[0]!.t, to: rows[rows.length - 1]!.t },
  } as DataSetMeta;
  await repo.saveDataset(meta, series);
  const props: AppProps = {
    repo,
    prefs: createMemoryPrefsRepo(),
    drawingsRepo: createMemoryDrawingsRepo(),
    journalRepo: createMemoryJournalRepo(),
    createImporter: createInProcessImporter,
    candleSource: createInProcessCandleSource(repo),
    ChartComponent: FakeChart,
  };
  render(<App {...props} />);
  await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('24'));
}

const count = () => screen.getByTestId('count').textContent;

describe('replay mode', () => {
  it('hides every bar after the cursor and steps one bar at a time', async () => {
    await setup();
    fireEvent.change(screen.getByLabelText('Replay başlangıcı'), {
      target: { value: '2026-01-07' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replay başlat' }));
    // 2026-01-07 00:00 Istanbul = 2026-01-06 21:00Z → 12 bars (18:00-20:45) are known
    await vi.waitFor(() => expect(count()).toBe('12'));
    expect(screen.getByTestId('last').textContent).toBe('2026-01-06T20:45:00.000Z');

    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    await vi.waitFor(() => expect(count()).toBe('13'));
    fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
    await vi.waitFor(() => expect(count()).toBe('12'));
  });

  it('supports the keyboard and restores the full chart when replay ends', async () => {
    await setup();
    fireEvent.change(screen.getByLabelText('Replay başlangıcı'), {
      target: { value: '2026-01-07' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replay başlat' }));
    await vi.waitFor(() => expect(count()).toBe('12'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await vi.waitFor(() => expect(count()).toBe('14'));
    fireEvent.click(screen.getByRole('button', { name: "Replay'i bitir" }));
    await vi.waitFor(() => expect(count()).toBe('24'));
  });
});
