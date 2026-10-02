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

// SYNTHETIC: six hours of 1m bars from Tue 2026-01-06 18:00Z; mids between 1.1000 and 1.1028.
const rows = Array.from({ length: 360 }, (_, i) => {
  const mid = 1.1 + ((i * 13) % 29) / 10_000;
  return {
    t: Date.parse('2026-01-06T18:00:00Z') + i * 60_000,
    o: mid,
    h: Math.round((mid + 0.0004) * 1e5) / 1e5,
    l: Math.round((mid - 0.0004) * 1e5) / 1e5,
    c: Math.round((mid + 0.0001) * 1e5) / 1e5,
    v: 1,
  };
});

const SHOT = new Uint8Array([137, 80, 78, 71]).buffer;

function FakeChart(p: ChartViewProps) {
  if (p.screenshotRef) p.screenshotRef.current = async () => ({ mime: 'image/png', data: SHOT });
  return <span data-testid="count">{p.candles.length}</span>;
}

async function setup() {
  const series = seriesFromRows(rows, true);
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
  let id = 0;
  render(
    <App
      repo={repo}
      prefs={createMemoryPrefsRepo()}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={journalRepo}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(repo)}
      ChartComponent={FakeChart}
      now={() => 5_000}
      newId={() => `id-${++id}`}
    />,
  );
  await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('24'));
  // Cursor 21:00Z (00:00 Istanbul), inside the New York session; last close 1.1008.
  fireEvent.change(screen.getByLabelText('Replay başlangıcı'), {
    target: { value: '2026-01-07' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Replay başlat' }));
  await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('12'));
  return { journalRepo };
}

const panel = () => within(screen.getByRole('region', { name: 'İşlem' }));
const form = () => within(screen.getByRole('dialog', { name: 'Günlük kaydı' }));

/** Long market, 5 pip stop: fills 21:00 at 1.1020 (stop 1.1003), stopped out in the 21:01 bar. */
async function loseOneTrade() {
  fireEvent.change(panel().getByLabelText('Stop'), { target: { value: '5' } });
  fireEvent.click(panel().getByRole('button', { name: 'Long emri ver' }));
  await vi.waitFor(() => expect(panel().getByText('Bekleyen emir')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
  await vi.waitFor(() => expect(screen.getByRole('dialog', { name: 'Günlük kaydı' })).toBeTruthy());
}

describe('journal form', () => {
  it('opens when a trade closes, prefilled with what was measured, and stores the entry', async () => {
    const { journalRepo } = await setup();
    await loseOneTrade();

    expect(form().getByText('EURUSD · Long')).toBeTruthy();
    expect(form().getByText('New York')).toBeTruthy();
    expect(form().getByTestId('journal-result').textContent).toBe('−1,00R · stop');
    expect(form().getByText('2dk')).toBeTruthy();

    fireEvent.change(form().getByLabelText('Neden bu kararı verdim?'), {
      target: { value: 'Asya dibi süpürüldü sandım' },
    });
    fireEvent.change(form().getByLabelText('Duygu'), { target: { value: 'FOMO' } });
    fireEvent.click(form().getByRole('button', { name: '4' }));
    fireEvent.change(form().getByLabelText('Ders / not'), { target: { value: 'Onay bekle' } });
    fireEvent.change(form().getByLabelText('Etiketler (virgülle)'), {
      target: { value: 'erken giriş, ny, erken giriş' },
    });
    fireEvent.click(form().getByRole('button', { name: 'Kaydet' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [entry] = await journalRepo.listEntries();
    expect(entry).toMatchObject({
      instrument: 'EURUSD',
      decision: 'LONG',
      decidedAt: Date.parse('2026-01-06T21:00:00Z'),
      timeframe: '15m',
      sessions: ['NEW_YORK'],
      reason: 'Asya dibi süpürüldü sandım',
      emotion: 'FOMO',
      emotionIntensity: 4,
      lesson: 'Onay bekle',
      tags: ['erken giriş', 'ny'],
      result: { r: -1, exitReason: 'SL', durationMs: 120_000, ambiguous: false },
      createdAt: 5_000,
    });
    expect(entry!.screenshotIds).toHaveLength(1);
    expect((await journalRepo.getScreenshot(entry!.screenshotIds[0]!))?.data).toBe(SHOT);
    const [trade] = await journalRepo.listTrades('EURUSD');
    expect(trade!.journalId).toBe(entry!.id);
    expect(entry!.tradeId).toBe(trade!.id);
    expect(panel().getByText('Günlüğe yazıldı.')).toBeTruthy();
  });

  it('can be skipped and reopened from the trade panel', async () => {
    const { journalRepo } = await setup();
    await loseOneTrade();
    fireEvent.click(form().getByRole('button', { name: 'Şimdilik atla' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await journalRepo.listEntries()).toEqual([]);

    fireEvent.click(panel().getByRole('button', { name: 'Günlüğe yaz' }));
    expect(form().getByTestId('journal-result').textContent).toBe('−1,00R · stop');
  });

  it('records a "no trade" decision without a result, optionally without a screenshot', async () => {
    const { journalRepo } = await setup();
    fireEvent.click(panel().getByRole('button', { name: 'İşlem yok kararını kaydet' }));
    expect(form().getByText('EURUSD · İşlem yok')).toBeTruthy();
    expect(form().queryByTestId('journal-result')).toBeNull();
    fireEvent.click(form().getByLabelText('Grafiğin ekran görüntüsünü ekle'));
    fireEvent.click(form().getByRole('button', { name: 'Kaydet' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [entry] = await journalRepo.listEntries();
    expect(entry).toMatchObject({
      decision: 'NO_TRADE',
      tradeId: null,
      result: null,
      screenshotIds: [],
      sessions: ['NEW_YORK'],
    });
  });
});
