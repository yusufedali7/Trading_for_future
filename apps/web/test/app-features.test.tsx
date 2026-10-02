import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';

// SYNTHETIC: six hours of wave-shaped 1m bars from Tue 2026-01-06 18:00Z (2-hour cycle).
const rows = Array.from({ length: 360 }, (_, i) => {
  const mid = 1.1 + 0.002 * Math.sin((2 * Math.PI * i) / 120) + ((i * 13) % 7) / 100_000;
  return {
    t: Date.parse('2026-01-06T18:00:00Z') + i * 60_000,
    o: mid,
    h: Math.round((mid + 0.0004) * 1e5) / 1e5,
    l: Math.round((mid - 0.0004) * 1e5) / 1e5,
    c: Math.round((mid + 0.0001) * 1e5) / 1e5,
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
  const prefs = createMemoryPrefsRepo();
  render(
    <App
      repo={repo}
      prefs={prefs}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={createMemoryJournalRepo()}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(repo)}
      ChartComponent={FakeChart}
    />,
  );
  await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('24'));
  return { prefs };
}

const toggles = () => within(screen.getByRole('group', { name: 'Motor adayları' }));

describe('engine candidate layers', () => {
  it('passes the computed candidates and the chosen layers to the chart; choices are saved', async () => {
    const { prefs } = await setup();
    expect(latest!.featureLayers).toEqual(['SWING', 'STRUCTURE', 'PREV_DAY']);
    expect(latest!.features!.swings.length).toBeGreaterThan(0);
    expect(toggles().getByRole('button', { name: 'FVG' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    fireEvent.click(toggles().getByRole('button', { name: 'FVG' }));
    fireEvent.click(toggles().getByRole('button', { name: 'Swing' }));
    expect(latest!.featureLayers).toEqual(['STRUCTURE', 'PREV_DAY', 'FVG']);
    await vi.waitFor(async () =>
      expect((await prefs.load()).features).toEqual(['STRUCTURE', 'PREV_DAY', 'FVG']),
    );
  });

  it('in replay only shows candidates confirmed by the cursor', async () => {
    await setup();
    const all = latest!.features!.swings.length;
    fireEvent.change(screen.getByLabelText('Replay başlangıcı'), {
      target: { value: '2026-01-07' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replay başlat' }));
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('12'));
    const cursor = Date.parse('2026-01-06T21:00:00Z');
    const f = latest!.features!;
    expect(f.swings.length).toBeLessThan(all);
    for (const d of [...f.swings, ...f.fvgs, ...f.breaks, ...f.sweeps])
      expect(d.confirmedAt).toBeLessThanOrEqual(cursor);
  });
});
