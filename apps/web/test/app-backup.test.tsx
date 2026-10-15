import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { defaultSpec, newVersion, type Strategy } from '@trw/engine';
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

const NOW = Date.parse('2026-10-06T12:00:00Z');

function FakeChart(p: ChartViewProps) {
  return <span data-testid="count">{p.candles.length}</span>;
}

function renderApp() {
  const prefs = createMemoryPrefsRepo();
  const strategies = createMemoryStrategyRepo();
  render(
    <App
      repo={createMemoryRepo()}
      prefs={prefs}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={createMemoryJournalRepo()}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(createMemoryRepo())}
      strategyRepo={strategies}
      researchRepo={createMemoryResearchRepo()}
      ChartComponent={FakeChart}
      now={() => NOW}
    />,
  );
  return { prefs, strategies };
}

/** Captures what the app hands to the browser's download. */
function captureDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  let last: Blob | null = null;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (b: Blob) => {
      last = b;
      return 'blob:test';
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    files.push({ name: this.download, blob: last! });
  });
  return files;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('backup in the app', () => {
  it('reminds, downloads a backup, and restores it into another app', async () => {
    const files = captureDownloads();
    const { prefs, strategies } = renderApp();
    const s: Strategy = {
      id: 's1',
      name: 'Deneme',
      description: '',
      latestVersion: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    await strategies.createStrategy(s, newVersion(s, defaultSpec(), '', 1));
    // Work exists, no backup yet → reminder (after a view change re-checks).
    fireEvent.click(await screen.findByRole('button', { name: 'Strateji' }));
    const button = await screen.findByRole('button', { name: /Yedek · Yedek alınmadı/ });

    fireEvent.click(button);
    const dialog = within(screen.getByRole('dialog', { name: 'Yedek ve dışa aktarma' }));
    expect(dialog.getByText(/kendi tarayıcında/)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Yedeği indir (JSON)' }));
    await waitLong(() => expect(files).toHaveLength(1));
    expect(files[0]!.name).toBe('trw-yedek-2026-10-06.json');
    await waitLong(async () => expect((await prefs.load()).lastBackupAt).toBe(NOW));
    expect(screen.queryByText(/Yedek alınmadı/)).toBeNull();
    const text = await files[0]!.blob.text();
    expect(JSON.parse(text).strategy.strategies).toHaveLength(1);

    cleanup();
    const other = renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /^Yedek/ }));
    const d2 = within(screen.getByRole('dialog', { name: 'Yedek ve dışa aktarma' }));
    const file = new File([text], 'yedek.json', { type: 'application/json' });
    fireEvent.change(d2.getByLabelText('Yedek dosyası'), { target: { files: [file] } });
    const preview = within(await d2.findByRole('table', { name: 'Geri yüklenecekler' }));
    const row = preview.getByText('Stratejiler').closest('tr')!;
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Stratejiler', '1', '0', '0', '0']);
    fireEvent.click(d2.getByRole('button', { name: 'Geri yükle' }));
    await waitLong(() => expect(d2.getByRole('status').textContent).toMatch(/kayıt eklendi/));
    expect((await other.strategies.listStrategies()).map((x) => x.id)).toEqual(['s1']);
  });

  it('explains a file that is not a backup', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /^Yedek/ }));
    const d = within(screen.getByRole('dialog', { name: 'Yedek ve dışa aktarma' }));
    const file = new File(['{"hello":1}'], 'x.json', { type: 'application/json' });
    fireEvent.change(d.getByLabelText('Yedek dosyası'), { target: { files: [file] } });
    expect((await d.findByRole('alert')).textContent).toMatch(/yedeği değil/);
  });
});
