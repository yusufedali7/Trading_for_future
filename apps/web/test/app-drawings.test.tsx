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
      <button type="button" onClick={() => p.onDrawn('TEXT', [{ t: rows[1]!.t, p: 1.08505 }])}>
        fake-draw-text
      </button>
      <button type="button" onClick={() => p.onErase?.(p.drawings[0]!.id)}>
        fake-erase
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

/** Opens a toolbar group's list and picks a tool from it. */
function pickTool(group: string, name: string) {
  fireEvent.click(screen.getByRole('button', { name: `${group}: diğer araçlar` }));
  fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name }));
}

const ctrl = (key: string, shiftKey = false) =>
  fireEvent.keyDown(window, { key, ctrlKey: true, shiftKey });

describe('drawing workflow', () => {
  it('draws with a tool, then returns to the select tool and selects the new drawing', async () => {
    const { drawingsRepo } = await setup();
    pickTool('Çizgiler', 'Yatay çizgi');
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
    pickTool('Çizgiler', 'Yatay çizgi');
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
    pickTool('Çizgiler', 'Yatay çizgi');
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Destek/direnç olarak kaydet' }));
    await screen.findByRole('list', { name: 'Destek / direnç seviyeleri' });
    fireEvent.keyDown(window, { key: 'Delete' });
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(await drawingsRepo.list('EURUSD')).toEqual({ drawings: [], levels: [] });
  });

  it('undoes and redoes drawing changes, bringing back a deleted level too', async () => {
    const { drawingsRepo } = await setup();
    pickTool('Çizgiler', 'Yatay çizgi');
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Destek/direnç olarak kaydet' }));
    await screen.findByRole('list', { name: 'Destek / direnç seviyeleri' });
    const saved = await drawingsRepo.list('EURUSD');

    fireEvent.keyDown(window, { key: 'Delete' });
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    ctrl('z');
    await vi.waitFor(async () => expect(await drawingsRepo.list('EURUSD')).toEqual(saved));
    expect(screen.getByTestId('count').textContent).toBe('1');

    ctrl('z'); // the level
    ctrl('z'); // the line
    await vi.waitFor(async () =>
      expect(await drawingsRepo.list('EURUSD')).toEqual({ drawings: [], levels: [] }),
    );
    ctrl('y');
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect((await drawingsRepo.list('EURUSD')).drawings).toEqual(saved.drawings);
    expect(screen.getByRole('button', { name: 'Yinele (Ctrl+Y)' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('erases a clicked drawing; removes all after confirmation; hides all', async () => {
    const { drawingsRepo } = await setup();
    pickTool('Çizgiler', 'Yatay çizgi');
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    pickTool('İmleçler', 'Silgi');
    expect(screen.getByTestId('tool').textContent).toBe('ERASER');
    fireEvent.click(screen.getByRole('button', { name: 'fake-erase' }));
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-hline' }));
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Tüm çizimleri gizle' }));
    expect(screen.getByTestId('count').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Çizimleri göster' }));
    expect(screen.getByTestId('count').textContent).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Tüm çizimleri sil' }));
    const dialog = within(screen.getByRole('alertdialog', { name: 'Tüm çizimleri sil' }));
    expect(dialog.getByText(/2 çizim silinsin mi/)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Evet, sil' }));
    await vi.waitFor(async () => expect((await drawingsRepo.list('EURUSD')).drawings).toEqual([]));
  });

  it('keeps the tool after drawing when asked; the text tool starts with editable text', async () => {
    const { drawingsRepo } = await setup();
    fireEvent.click(screen.getByRole('button', { name: /Çizimde kal/ }));
    pickTool('Notlar', 'Metin');
    fireEvent.click(screen.getByRole('button', { name: 'fake-draw-text' }));
    await vi.waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(screen.getByTestId('tool').textContent).toBe('TEXT');
    expect((await drawingsRepo.list('EURUSD')).drawings[0]).toMatchObject({
      kind: 'TEXT',
      text: 'Metin',
    });

    const panel = within(screen.getByRole('region', { name: 'Seçili çizim' }));
    const input = panel.getByLabelText('Metin');
    fireEvent.change(input, { target: { value: 'Londra açılışı' } });
    fireEvent.blur(input);
    await vi.waitFor(async () =>
      expect((await drawingsRepo.list('EURUSD')).drawings[0]!.text).toBe('Londra açılışı'),
    );
  });
});
