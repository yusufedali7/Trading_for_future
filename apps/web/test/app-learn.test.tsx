import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { LESSONS } from '../src/content/lessons';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { waitLong } from './helpers/wait';

// SYNTHETIC: two hours of wave-shaped 1m bars from Tue 2026-01-06 18:00Z.
const rows = Array.from({ length: 120 }, (_, i) => {
  const mid = 1.1 + 0.001 * Math.sin((2 * Math.PI * i) / 30);
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

async function setup(withData: boolean) {
  const repo = createMemoryRepo();
  if (withData) {
    const series = seriesFromRows(rows, false);
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
  }
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
  if (withData) await waitLong(() => expect(screen.getByTestId('count')).toBeTruthy());
  return { prefs };
}

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true';
const [first, second] = LESSONS;

describe('learning path (D73)', () => {
  it('starts from the empty screen when there is no data yet', async () => {
    await setup(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Öğrenme yoluna başla' }));
    expect(pressed('Öğren')).toBe(true);
    expect(pressed('Öğrenme yolu')).toBe(true);
    expect(screen.getByRole('article', { name: first!.title })).toBeTruthy();
  });

  it('opens a lesson’s glossary term and concept from its actions', async () => {
    await setup(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Öğren' }));
    const lesson = within(screen.getByRole('article', { name: first!.title }));
    fireEvent.click(lesson.getByRole('button', { name: 'Sözlükte: Pip' }));
    expect(pressed('Sözlük')).toBe(true);
    const sel = document.querySelector('[data-selected="true"]') as HTMLElement;
    expect(within(sel).getByRole('heading').textContent).toBe('Pip');

    fireEvent.click(screen.getByRole('button', { name: 'Öğrenme yolu' }));
    fireEvent.click(screen.getByRole('button', { name: /Swing tepe\/dip ve onay gecikmesi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kavram: Swing (tepe / dip)' }));
    expect(pressed('Kavramlar')).toBe(true);
    expect(screen.getByRole('article', { name: 'Swing (tepe / dip)' })).toBeTruthy();
  });

  it('remembers completed lessons and moves on to the next one', async () => {
    const { prefs } = await setup(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Öğren' }));
    expect(screen.getByText(`0 / ${LESSONS.length} ders tamamlandı`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tamamladım' }));
    await waitLong(async () =>
      expect((await prefs.load()).learning.completed).toEqual([first!.id]),
    );
    expect(screen.getByText(`1 / ${LESSONS.length} ders tamamlandı`)).toBeTruthy();
    expect(screen.getByRole('article', { name: second!.title })).toBeTruthy();
  });

  it('shows the next lesson on the chart and turns on a layer from a lesson', async () => {
    const { prefs } = await setup(true);
    fireEvent.click(screen.getByRole('button', { name: `Sıradaki ders: ${first!.title}` }));
    expect(pressed('Öğren')).toBe(true);
    expect(screen.getByRole('article', { name: first!.title })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /FVG \(adil değer boşluğu\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Alıştırma yap' }));
    expect(pressed('Alıştırma')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Öğrenme yolu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grafikte aç: FVG' }));
    expect(pressed('Grafik')).toBe(true);
    await waitLong(async () => expect((await prefs.load()).features).toContain('FVG'));
    expect(latest!.featureLayers).toContain('FVG');
  });

  it('hides the chart hint when asked', async () => {
    const { prefs } = await setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ders önerisini gizle' }));
    expect(screen.queryByRole('button', { name: /Sıradaki ders/ })).toBeNull();
    await waitLong(async () => expect((await prefs.load()).learning.hideHint).toBe(true));
  });

  it('runs a seeded practice round on the loaded data and keeps its score (D74)', async () => {
    const { prefs } = await setup(true);
    fireEvent.click(screen.getByRole('button', { name: '1m' }));
    await waitLong(() => expect(screen.getByTestId('count').textContent).toBe('120'));
    fireEvent.click(screen.getByRole('button', { name: 'Öğren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alıştırma' }));
    fireEvent.click(screen.getByRole('button', { name: /Yeni tur başlat/ }));

    let answered = 0;
    let right = 0;
    while (screen.queryByRole('button', { name: 'Evet' })) {
      expect(screen.getByRole('img', { name: /Grafik/ })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Evet' }));
      answered++;
      if (screen.queryByText(/^Doğru/)) right++;
      fireEvent.click(screen.getByRole('button', { name: /Sonraki soru|Turu bitir/ }));
    }
    expect(answered).toBeGreaterThan(0);
    expect(
      screen.getByText(`${answered} sorudan ${right} doğru (bu veride, bu turda).`),
    ).toBeTruthy();
    await waitLong(async () => {
      const [round] = (await prefs.load()).learning.exercises;
      expect(round).toMatchObject({
        datasetId: 'ds',
        timeframe: '1m',
        total: answered,
        correct: right,
      });
      expect(Number.isInteger(round!.seed)).toBe(true);
    });
  });

  it('asks nothing without real data (rule 1)', async () => {
    await setup(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Öğren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alıştırma' }));
    expect(screen.queryByRole('button', { name: /Yeni tur başlat/ })).toBeNull();
    expect(screen.getByText(/gerçek veri/)).toBeTruthy();
  });
});
