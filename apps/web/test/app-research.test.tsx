import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  defaultSpec,
  newVersion,
  seriesFromRows,
  type DataSetMeta,
  type Strategy,
} from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { createMemoryResearchRepo, createMemoryStrategyRepo } from '../src/storage/strategy-repo';
import { waitLong } from './helpers/wait';

// SYNTHETIC: 25 hours of wave-shaped 1m bars from Mon 2026-01-05 12:00Z (30-minute cycle).
const rows = Array.from({ length: 1500 }, (_, i) => {
  const r = (x: number) => Math.round(x * 1e5) / 1e5;
  const mid = 1.1 + 0.001 * Math.sin((2 * Math.PI * i) / 30) + ((i * 13) % 7) / 100_000;
  return {
    t: Date.parse('2026-01-05T12:00:00Z') + i * 60_000,
    o: r(mid),
    h: r(mid + 0.0003),
    l: r(mid - 0.0003),
    c: r(mid + 0.0001),
  };
});

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
  const strategies = createMemoryStrategyRepo();
  const s: Strategy = {
    id: 's1',
    name: 'Dip alımı',
    description: '',
    latestVersion: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  await strategies.createStrategy(
    s,
    newVersion(
      s,
      {
        ...defaultSpec(),
        timeframe: '1m',
        steps: [{ id: 'low', type: 'SWING', kind: 'LOW' }],
        stop: { type: 'FIXED_PIPS', pips: 5 },
      },
      '',
      1,
    ),
  );
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
  fireEvent.click(screen.getByRole('button', { name: 'Araştırma' }));
  return { strategies, research };
}

async function createHypothesis() {
  fireEvent.click(await screen.findByRole('button', { name: 'Yeni hipotez' }));
  const form = within(await screen.findByRole('form', { name: 'Yeni hipotez' }));
  fireEvent.change(form.getByLabelText('Başlık'), { target: { value: 'Dipten alım' } });
  fireEvent.change(form.getByLabelText(/Hipotez \(test/), {
    target: { value: 'Swing dibinden sonra alım maliyet sonrası pozitif R verir.' },
  });
  // In-sample: data start → 2026-01-06 00:00 Istanbul (21:00Z); out-of-sample after it.
  await waitLong(() =>
    expect((form.getByLabelText('Başlangıç') as HTMLInputElement).value).toBe('2026-01-05'),
  );
  fireEvent.change(form.getByLabelText('In-sample / out-of-sample sınırı'), {
    target: { value: '2026-01-06' },
  });
  expect(form.queryByRole('alert')).toBeNull();
  fireEvent.click(form.getByRole('button', { name: 'Hipotezi kaydet' }));
  await waitLong(() => expect(screen.getByRole('heading', { name: /Dipten alım/ })).toBeTruthy());
}

describe('research lab', () => {
  it('runs a base test and an in-sample sweep, counts every trial and shows the grid', async () => {
    const { research } = await setup();
    await createHypothesis();
    fireEvent.click(screen.getByRole('button', { name: /kendi kurallarıyla in-sample/ }));
    await screen.findByText('In-sample deneme sayısı (bu hipotez): 1');

    fireEvent.change(screen.getByLabelText('Parametre'), { target: { value: 'target.r' } });
    fireEvent.change(screen.getAllByLabelText(/Değerler/)[0]!, { target: { value: '1; 1,5; 2' } });
    const go = screen.getByRole('button', { name: /3 kombinasyon = 3 deneme/ });
    fireEvent.click(go);
    await screen.findByText('In-sample deneme sayısı (bu hipotez): 4');

    const grid = within(screen.getByRole('table', { name: /Tarama sonuçları/ }));
    expect(grid.getAllByRole('row')).toHaveLength(4); // header + 3 values
    const runs = await research.listHypothesisRuns('id-1');
    expect(runs.filter((b) => b.run.research?.variant).map((b) => b.run.research!.variant)).toEqual(
      [{ 'target.r': 2 }, { 'target.r': 1.5 }, { 'target.r': 1 }],
    );
    // A changed value stores the exact rules; the unchanged one is the version itself.
    const r1 = runs.find((b) => b.run.research?.variant?.['target.r'] === 1)!;
    expect(r1.run.research!.spec!.target).toEqual({ type: 'R_MULTIPLE', r: 1 });
    expect(
      runs.find((b) => b.run.research?.variant?.['target.r'] === 2)!.run.research!.spec,
    ).toBeUndefined();
    expect(runs.every((b) => b.run.split.role === 'IN_SAMPLE')).toBe(true);
  });

  it('opens out-of-sample once after confirmation, saves a variant as a version and concludes', async () => {
    const { research, strategies } = await setup();
    await createHypothesis();
    fireEvent.change(screen.getByLabelText('Parametre'), { target: { value: 'target.r' } });
    fireEvent.change(screen.getAllByLabelText(/Değerler/)[0]!, { target: { value: '1; 3' } });
    fireEvent.click(screen.getByRole('button', { name: /2 kombinasyon/ }));
    const grid = await screen.findByRole('table', { name: /Tarama sonuçları/ });
    fireEvent.click(within(grid).getAllByRole('button')[0]!); // target.r = 1

    fireEvent.click(screen.getByRole('button', { name: /yeni strateji versiyonu/ }));
    await waitLong(async () => expect(await strategies.listVersions('s1')).toHaveLength(2));
    const [, v2] = await strategies.listVersions('s1');
    expect(v2!.spec.target).toEqual({ type: 'R_MULTIPLE', r: 1 });
    expect(v2!.changeNote).toMatch(/target.r=1/);

    fireEvent.click(screen.getByRole('button', { name: /Out-of-sample’ı bu ayarla aç/ }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Evet, aç' }),
    );
    await waitLong(async () =>
      expect((await research.listHypotheses())[0]!.oosRunIds).toHaveLength(1),
    );
    const [h] = await research.listHypotheses();
    const oosRun = (await research.listHypothesisRuns(h!.id)).find(
      (b) => b.run.id === h!.oosRunIds[0],
    )!;
    expect(oosRun.run.split.role).toBe('OUT_OF_SAMPLE');
    expect(oosRun.run.research!.variant).toEqual({ 'target.r': 1 });

    fireEvent.change(screen.getByLabelText('Sonuç'), { target: { value: 'NOT_SUPPORTED' } });
    fireEvent.change(screen.getByLabelText('Sonuç notu'), { target: { value: 'Az veri.' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Sonucu kaydet' }));
    await waitLong(async () =>
      expect((await research.listHypotheses())[0]).toMatchObject({
        status: 'NOT_SUPPORTED',
        conclusion: 'Az veri.',
        evidenceRunIds: [oosRun.run.id],
      }),
    );
  });
});
