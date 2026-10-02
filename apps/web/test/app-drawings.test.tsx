import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App, type AppProps } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';

// SYNTHETIC: three 1m bars so the app has a dataset to show.
const rows = [0, 1, 2].map((i) => ({
  t: Date.parse('2026-01-06T15:00:00Z') + i * 60_000,
  o: 1.085,
  h: 1.0852,
  l: 1.0849,
  c: 1.0851,
  v: 1,
}));

/** Stand-in for the canvas chart: exposes the tool and lets the test "draw". */
function FakeChart(p: ChartViewProps) {
  return (
    <div data-testid="chart">
      <span data-testid="tool">{p.tool}</span>
      <span data-testid="count">{p.drawings.length}</span>
      <button type="button" onClick={() => p.onDrawn('HLINE', [{ t: rows[1]!.t, p: 1.08505 }])}>
        fake-draw-hline
      </button>
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
    range: { from: rows[0]!.t, to: rows[2]!.t },
  } as DataSetMeta;
  await repo.saveDataset(meta, series);
  const drawingsRepo = createMemoryDrawingsRepo();
  let id = 0;
  const props: AppProps = {
    repo,
    prefs: createMemoryPrefsRepo(),
    drawingsRepo,
    journalRepo: createMemoryJournalRepo(),
    createImporter: createInProcessImporter,
    candleSource: createInProcessCandleSource(repo),
    ChartComponent: FakeChart,
    now: () => 5_000,
    newId: () => `id-${++id}`,
  };
  render(<App {...props} />);
  await screen.findByTestId('chart');
  return { drawingsRepo };
}

describe('drawing workflow', () => {
  it('draws with a tool, then returns to the select tool and selects the new drawing', async () => {
    const { drawingsRepo } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Yatay çizgi' }));
    expect(screen.getByTestId('tool').textContent).toBe('HLINE');
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('tool').textContent).toBe('SELECT');
    expect(screen.getByRole('heading', { name: 'Seçili çizim' })).toBeTruthy();
    const { drawings } = await drawingsRepo.list('EURUSD');
    expect(drawings[0]).toMatchObject({
      id: 'id-1',
      kind: 'HLINE',
      source: 'USER',
      instrument: 'EURUSD',
      anchors: [{ t: rows[1]!.t, p: 1.08505 }],
      createdAt: 5_000,
    });
  });

  it('saves a horizontal line as a support level and records status changes', async () => {
    const { drawingsRepo } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Yatay çizgi' }));
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Destek/direnç olarak kaydet' }));
    const list = await screen.findByRole('list', { name: 'Destek / direnç seviyeleri' });
    // Chart opens on 15m (default preference); the line is below the last close → support.
    expect(within(list).getByText(/Destek · 15m · Aktif/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'BROKEN' } });
    await vi.waitFor(async () => {
      const { levels } = await drawingsRepo.list('EURUSD');
      expect(levels[0]!.statusHistory.map((h) => h.status)).toEqual(['ACTIVE', 'BROKEN']);
    });
    expect(await within(list).findByText(/Kırıldı/)).toBeTruthy();
  });

  it('deletes the selected drawing (and its level) with the Delete key', async () => {
    const { drawingsRepo } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Yatay çizgi' }));
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Destek/direnç olarak kaydet' }));
    await screen.findByRole('list', { name: 'Destek / direnç seviyeleri' });
    fireEvent.keyDown(window, { key: 'Delete' });
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(await drawingsRepo.list('EURUSD')).toEqual({ drawings: [], levels: [] });
  });
});
