import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta, type JournalEntry } from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { waitLong } from './helpers/wait';

// SYNTHETIC: a few 1m bars so the app has a dataset, and three hand-written journal entries.
const rows = Array.from({ length: 30 }, (_, i) => ({
  t: Date.parse('2026-01-06T18:00:00Z') + i * 60_000,
  o: 1.1,
  h: 1.1002,
  l: 1.0998,
  c: 1.1001,
}));

const base: JournalEntry = {
  id: 'a',
  instrument: 'EURUSD',
  decision: 'LONG',
  decidedAt: Date.parse('2026-01-06T09:00:00Z'),
  timeframe: '15m',
  sessions: ['LONDON'],
  tradeId: 'ta',
  result: { r: 2, exitReason: 'TP', maeR: 0.3, mfeR: 2, durationMs: 5_400_000, ambiguous: false },
  strategy: 'SYNTHETIC',
  reason: 'Londra açılışında süpürme',
  emotion: 'CALM',
  emotionIntensity: 2,
  lesson: 'Sabırlı ol',
  tags: ['sweep'],
  screenshotIds: ['shot-a'],
  createdAt: 1,
  updatedAt: 1,
};
const entries: JournalEntry[] = [
  base,
  {
    ...base,
    id: 'b',
    decision: 'SHORT',
    decidedAt: Date.parse('2026-01-07T15:00:00Z'),
    sessions: ['NEW_YORK'],
    tradeId: 'tb',
    result: { r: -1, exitReason: 'SL', maeR: 1, mfeR: 0.2, durationMs: 600_000, ambiguous: true },
    emotion: 'FOMO',
    emotionIntensity: 4,
    tags: [],
    screenshotIds: [],
  },
  {
    ...base,
    id: 'c',
    decision: 'NO_TRADE',
    decidedAt: Date.parse('2026-01-08T10:00:00Z'),
    tradeId: null,
    result: null,
    tags: [],
    screenshotIds: [],
  },
];

function FakeChart(p: ChartViewProps) {
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
  const journalRepo = createMemoryJournalRepo();
  for (const e of entries) await journalRepo.saveEntry(e);
  await journalRepo.saveScreenshot({ id: 'shot-a', mime: 'image/png', data: new ArrayBuffer(4) });
  render(
    <App
      repo={repo}
      prefs={createMemoryPrefsRepo()}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={journalRepo}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(repo)}
      ChartComponent={FakeChart}
    />,
  );
  await waitLong(() => expect(screen.getByTestId('count')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Günlük' }));
  await waitLong(() => expect(screen.getByText('3 / 3 kayıt')).toBeTruthy());
  return { journalRepo };
}

const rowsShown = () => screen.getAllByRole('row').length - 1; // minus the header
const summary = () => within(screen.getByRole('region', { name: 'Özet (filtrelenmiş kayıtlar)' }));
const value = (label: string) => summary().getByText(label).nextElementSibling?.textContent;

describe('journal page', () => {
  it('lists entries newest first with measured summary statistics and honesty warnings', async () => {
    await setup();
    expect(rowsShown()).toBe(3);
    const firstRow = screen.getAllByRole('row')[1]!;
    expect(within(firstRow).getByText('İşlem yok')).toBeTruthy();

    expect(value('Kayıt')).toBe('3 (Long 1 · Short 1 · İşlem yok 1)');
    expect(value('Sonuçlu işlem')).toBe('2');
    expect(value('Kazanma oranı')).toBe('%50,0');
    expect(value('Ortalama R (beklenen değer)')).toBe('+0,50R');
    expect(value('Profit factor')).toBe('2');
    expect(value('Maksimum düşüş')).toBe('−1,00R');
    expect(summary().getByText(/30’dan az/)).toBeTruthy();
    expect(summary().getByText(/1 işlemde aynı mumda stop ve hedef/)).toBeTruthy();
  });

  it('filters by outcome, emotion, session and date (in the display time zone)', async () => {
    await setup();
    const filters = within(screen.getByRole('form', { name: 'Filtreler' }));
    fireEvent.change(filters.getByLabelText('Sonuç'), { target: { value: 'LOSS' } });
    expect(rowsShown()).toBe(1);
    expect(value('Kazanma oranı')).toBe('%0,0');

    fireEvent.click(filters.getByRole('button', { name: 'Filtreleri temizle' }));
    fireEvent.change(filters.getByLabelText('Duygu'), { target: { value: 'CALM' } });
    expect(rowsShown()).toBe(2);

    fireEvent.click(filters.getByRole('button', { name: 'Filtreleri temizle' }));
    fireEvent.change(filters.getByLabelText('Seans'), { target: { value: 'LONDON' } });
    expect(rowsShown()).toBe(2); // a and c share the base sessions

    fireEvent.click(filters.getByRole('button', { name: 'Filtreleri temizle' }));
    // 2026-01-07 in Istanbul: 2026-01-06T21:00Z → 2026-01-07T21:00Z → only b (15:00Z)
    fireEvent.change(filters.getByLabelText('Başlangıç'), { target: { value: '2026-01-07' } });
    fireEvent.change(filters.getByLabelText('Bitiş'), { target: { value: '2026-01-07' } });
    expect(rowsShown()).toBe(1);
    expect(screen.getByText('1 / 3 kayıt')).toBeTruthy();
  });

  it('shows the details of an entry and deletes it only after confirmation', async () => {
    const { journalRepo } = await setup();
    fireEvent.click(screen.getByRole('button', { name: '2026-01-06 12:00' }));
    const detail = within(screen.getByRole('region', { name: 'Kayıt ayrıntısı' }));
    expect(detail.getByText('Londra açılışında süpürme')).toBeTruthy();
    expect(detail.getByText('+2,00R · hedef')).toBeTruthy();

    fireEvent.click(detail.getByRole('button', { name: 'Kaydı sil' }));
    expect(await journalRepo.listEntries()).toHaveLength(3);
    fireEvent.click(detail.getByRole('button', { name: 'Evet, sil' }));
    await waitLong(() => expect(screen.getByText('2 / 2 kayıt')).toBeTruthy());
    expect((await journalRepo.listEntries()).map((e) => e.id)).toEqual(['c', 'b']);
    expect(await journalRepo.getScreenshot('shot-a')).toBeUndefined();
  });
});
