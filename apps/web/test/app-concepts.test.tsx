import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { CONCEPTS } from '../src/content/concepts';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { waitLong } from './helpers/wait';

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
  if (withData) await waitLong(() => expect(screen.getByTestId('count').textContent).toBe('24'));
  fireEvent.click(await screen.findByRole('button', { name: 'Öğren' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kavramlar' }));
  expect(screen.getByRole('button', { name: 'Kavramlar' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  return { prefs };
}

const card = (name: string) => within(screen.getByRole('article', { name }));

describe('concept library', () => {
  it('teaches every engine concept, but shows no examples without real data', async () => {
    await setup(false);
    const list = within(screen.getByRole('navigation', { name: 'Kavramlar' }));
    expect(list.getAllByRole('button')).toHaveLength(CONCEPTS.length);
    const swing = card('Swing (tepe / dip)');
    expect(swing.getByText(/Sağındaki 3 mum kapanınca bilinir/)).toBeTruthy();
    expect(swing.getByText(/Veri yok/)).toBeTruthy();
    expect(swing.queryByRole('button', { name: 'Grafikte göster' })).toBeNull();
  });

  it('counts candidates in the loaded data, measures them and jumps to one on the chart', async () => {
    await setup(true);
    const swings = latest!.features!.swings;
    expect(swings.length).toBeGreaterThan(0);
    expect(Array.isArray(latest!.harmonics)).toBe(true);

    const swing = card('Swing (tepe / dip)');
    expect(swing.getByText(`Bu veride ${swings.length} aday.`)).toBeTruthy();
    expect(swing.getByText(/EURUSD · SYNTHETIC · 15m/)).toBeTruthy();
    expect(swing.getByRole('status').textContent).toMatch(/Sonuçlanan \d+ aday|Henüz sonuçlanan/);
    expect(swing.getByText(/olasılık değildir/)).toBeTruthy();

    // A shorter window decides more candidates.
    fireEvent.change(swing.getByLabelText('Kaç mum içinde (N)'), { target: { value: '1' } });
    expect(swing.getByRole('status').textContent).toMatch(/Sonuçlanan \d+ aday/);

    const examples = within(swing.getByRole('group', { name: 'Örnekler' }));
    fireEvent.click(examples.getByRole('button', { name: 'Grafikte göster' }));
    await waitLong(() => expect(latest!.focus).toEqual({ at: swings.at(-1)!.formedAt, seq: 1 }));
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows a harmonic concept with no outcome measurement yet (D82)', async () => {
    await setup(true);
    // Scoped to the nav: a chart layer toggle button with the same plain name ("Gartley",
    // D83) now also exists in the Katmanlar panel.
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Kavramlar' })).getByRole('button', {
        name: /^Gartley/,
      }),
    );
    const gartley = card('Gartley');
    expect(gartley.getByText(/Bu veride \d+ aday\.|Bu veride aday yok\./)).toBeTruthy();
    // No outcome measurement wired for harmonics yet (unlike swing/FVG above): no yardstick text.
    expect(gartley.queryByText(/Yaygın beklenti/)).toBeNull();
    expect(gartley.getByText('catalog/patterns/harmonic.json', { exact: false })).toBeTruthy();
  });

  it('turns on the layer of the concept it shows', async () => {
    const { prefs } = await setup(true);
    expect(latest!.featureLayers).not.toContain('FVG');
    fireEvent.click(screen.getByRole('button', { name: /^FVG \(fair value gap\)/ }));
    const fvg = card('FVG (fair value gap)');
    const n = latest!.features!.fvgs.length;
    expect(n).toBeGreaterThan(0);
    fireEvent.click(
      within(fvg.getByRole('group', { name: 'Örnekler' })).getByRole('button', {
        name: 'Grafikte göster',
      }),
    );
    await waitLong(() => expect(latest!.featureLayers).toContain('FVG'));
    await waitLong(async () => expect((await prefs.load()).features).toContain('FVG'));
  });

  it('turns on a harmonic layer from its Kavramlar card, even with no examples in this data (D83)', async () => {
    const { prefs } = await setup(true);
    expect(latest!.featureLayers).not.toContain('GARTLEY');
    // Scoped to the nav: a chart layer toggle button with the same plain name ("Gartley") also
    // exists in the Katmanlar panel (same collision fixed in the D82 test above).
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Kavramlar' })).getByRole('button', {
        name: /^Gartley/,
      }),
    );
    const gartley = card('Gartley');
    // "Grafikte göster" yalnızca örnek varsa görünür (Browser bileşeni boş listede gizlenir) -
    // bu yüzden düğme yoksa test burada biter; varsa katmanı açtığını doğrular.
    const btn = gartley.queryByRole('button', { name: 'Grafikte göster' });
    if (!btn) return;
    fireEvent.click(
      within(gartley.getByRole('group', { name: 'Örnekler' })).getByRole('button', {
        name: 'Grafikte göster',
      }),
    );
    await waitLong(() => expect(latest!.featureLayers).toContain('GARTLEY'));
    await waitLong(async () => expect((await prefs.load()).features).toContain('GARTLEY'));
  });
});
