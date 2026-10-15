import { describe, expect, it } from 'vitest';
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
import { waitLong } from './helpers/wait';

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

function FakeChart(p: ChartViewProps) {
  return (
    <div data-testid="chart">
      <span data-testid="count">{p.candles.length}</span>
      <span data-testid="lines">
        {(p.tradeLines ?? []).map((l) => `${l.kind}:${l.price}`).join(' ')}
      </span>
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
  const journalRepo = createMemoryJournalRepo();
  let id = 0;
  const props: AppProps = {
    repo,
    prefs: createMemoryPrefsRepo(),
    drawingsRepo: createMemoryDrawingsRepo(),
    journalRepo,
    createImporter: createInProcessImporter,
    candleSource: createInProcessCandleSource(repo),
    ChartComponent: FakeChart,
    now: () => 1_000,
    newId: () => `id-${++id}`,
  };
  render(<App {...props} />);
  await waitLong(() => expect(screen.getByTestId('count').textContent).toBe('24'));
  // 2026-01-07 00:00 Istanbul = 21:00Z: last known 1m bar is 20:59 (close 1.1008).
  fireEvent.change(screen.getByLabelText('Replay başlangıcı'), {
    target: { value: '2026-01-07' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Replay başlat' }));
  await waitLong(() => expect(screen.getByTestId('count').textContent).toBe('12'));
  return { journalRepo };
}

const panel = () => within(screen.getByRole('region', { name: 'İşlem' }));

describe('replay trade panel', () => {
  it('asks for a replay before trading', async () => {
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
    render(
      <App
        repo={repo}
        prefs={createMemoryPrefsRepo()}
        drawingsRepo={createMemoryDrawingsRepo()}
        journalRepo={createMemoryJournalRepo()}
        createImporter={createInProcessImporter}
        candleSource={createInProcessCandleSource(repo)}
        ChartComponent={FakeChart}
      />,
    );
    await waitLong(() => expect(screen.getByTestId('count').textContent).toBe('24'));
    expect(panel().getByText(/replay başlat/i)).toBeTruthy();
    expect(panel().queryByRole('button', { name: /emri ver/ })).toBeNull();
  });

  it('opens a market long at the next bar, tracks R as the cursor moves and closes by hand', async () => {
    const { journalRepo } = await setup();
    // Defaults: market order, 20 pip stop, 40 pip target from the last close 1.1008.
    expect(panel().getByText('SL 1.09880 · TP 1.10480 · R:R 2')).toBeTruthy();
    expect(panel().getByText(/Maliyetsiz/)).toBeTruthy();
    fireEvent.click(panel().getByRole('button', { name: 'Long emri ver' }));

    await waitLong(() => expect(panel().getByText('Bekleyen emir')).toBeTruthy());
    expect(screen.getByTestId('lines').textContent).toBe('STOP:1.0988 TARGET:1.1048');
    // No going back while the order is live.
    expect(screen.getByRole('button', { name: 'Geri' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: "Replay'i bitir" })).toHaveProperty('disabled', true);

    // One 15m step: fills at the 21:00 open (1.1020); 21:14 closes at 1.1029 → +0.28R.
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    await waitLong(() => expect(panel().getByText('Açık pozisyon')).toBeTruthy());
    expect(panel().getByTestId('trade-r').textContent).toBe('+0,28R');
    expect(screen.getByTestId('lines').textContent).toBe('ENTRY:1.102 STOP:1.0988 TARGET:1.1048');
    expect((await journalRepo.listTrades('EURUSD'))[0]!.result.status).toBe('OPEN');

    fireEvent.click(panel().getByRole('button', { name: 'Pozisyonu kapat' }));
    await waitLong(() => expect(panel().getByText('Kapandı · elle kapatıldı')).toBeTruthy());
    expect(panel().getByTestId('trade-r').textContent).toBe('+0,28R');
    const [saved] = await journalRepo.listTrades('EURUSD');
    expect(saved!.result).toMatchObject({
      status: 'CLOSED',
      exitReason: 'MANUAL',
      entryPrice: 1.102,
      exitPrice: 1.1029,
    });
    expect(screen.getByRole('button', { name: 'Geri' })).toHaveProperty('disabled', false);

    fireEvent.click(panel().getByRole('button', { name: 'Yeni işlem' }));
    expect(panel().getByRole('button', { name: 'Long emri ver' })).toBeTruthy();
    expect(screen.getByTestId('lines').textContent).toBe('');
  });

  it('cancels a pending limit order', async () => {
    const { journalRepo } = await setup();
    fireEvent.change(panel().getByLabelText('Emir tipi'), { target: { value: 'LIMIT' } });
    fireEvent.change(panel().getByLabelText('Emir fiyatı'), { target: { value: '1.0950' } });
    fireEvent.click(panel().getByRole('button', { name: 'Long emri ver' }));
    await waitLong(() => expect(panel().getByText('Bekleyen emir')).toBeTruthy());
    expect(screen.getByTestId('lines').textContent).toBe('ORDER:1.095 STOP:1.093 TARGET:1.099');

    fireEvent.click(panel().getByRole('button', { name: 'Emri iptal et' }));
    await waitLong(() => expect(panel().getByText('İptal edildi')).toBeTruthy());
    expect((await journalRepo.listTrades('EURUSD'))[0]!.result.status).toBe('CANCELLED');
  });

  it('explains an order that cannot be placed and switches pip distances to prices', async () => {
    await setup();
    fireEvent.click(panel().getByRole('button', { name: 'Short' }));
    fireEvent.click(panel().getByRole('button', { name: 'Fiyat' }));
    // 20 pips above / 40 pips below 1.1008 for a short.
    expect((panel().getByLabelText('Stop') as HTMLInputElement).value).toBe('1.10280');
    expect((panel().getByLabelText('Hedef') as HTMLInputElement).value).toBe('1.09680');

    fireEvent.change(panel().getByLabelText('Stop'), { target: { value: '1.0900' } });
    expect(panel().getByRole('alert').textContent).toMatch(/Stop, girişin yanlış tarafında/);
    expect(panel().getByRole('button', { name: 'Short emri ver' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
