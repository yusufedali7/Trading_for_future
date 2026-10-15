import { describe, expect, it } from 'vitest';
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
import { waitLong } from './helpers/wait';

// SYNTHETIC: six hours of wave-shaped 1m bars.
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
  await waitLong(() => expect(screen.getByTestId('count').textContent).toBe('24'));
  return { prefs };
}

const open = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('indicator toolbar', () => {
  it('toggling SMA reaches the chart and is saved; period edits too', async () => {
    const { prefs } = await setup();
    expect(latest!.indicators!.sma.on).toBe(false);

    open(/^İndikatörler/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'SMA' }));
    expect(latest!.indicators!.sma.on).toBe(true);
    await waitLong(async () => expect((await prefs.load()).indicators.sma.on).toBe(true));

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '9' } });
    expect(latest!.indicators!.sma.period).toBe(9);
  });

  it('switches the oscillator and shows its own period fields', async () => {
    await setup();
    open(/^İndikatörler/);
    const group = within(screen.getByRole('radiogroup', { name: 'Osilatör' }));
    fireEvent.click(group.getByRole('radio', { name: 'MACD' }));
    expect(latest!.indicators!.oscillator).toBe('MACD');
    expect(screen.getByText('Hızlı')).toBeTruthy();
    expect(screen.queryByText('RSI')).toBeTruthy(); // still the radio label, not a period field
  });
});
