import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CandleSeries, DataSetMeta } from '@trw/engine';
import { ImportWizard } from '../src/features/import/ImportWizard';
import { createInProcessImporter } from '../src/import/importer';

// SYNTHETIC: hand-written CSV rows used only to drive the wizard.
const HEADER = 'Gmt time,Open,High,Low,Close,Volume';
const r = (m: number, o = '1.08500') => `06.01.2026 15:0${m}:00.000,${o},1.08520,1.08490,1.08510,1`;

function setup(csv: string) {
  const save = vi.fn(async (_meta: DataSetMeta, _series: CandleSeries) => {});
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <ImportWizard
      createImporter={createInProcessImporter}
      save={save}
      onSaved={onSaved}
      onClose={onClose}
      now={() => 1_000}
      newId={() => 'ds-1'}
    />,
  );
  fireEvent.change(screen.getByLabelText('Dosya'), {
    target: { files: [new File([csv], 'SYNTHETIC_wizard.csv')] },
  });
  return { save, onSaved, onClose };
}

async function readAndAnalyze() {
  fireEvent.click(screen.getByRole('button', { name: 'Dosyayı oku' }));
  await screen.findByText('Önizleme (ilk satırlar)');
  fireEvent.click(screen.getByRole('button', { name: 'Analiz et' }));
  await screen.findByRole('heading', { name: 'Doğrulama raporu' });
}

describe('ImportWizard', () => {
  it('imports a clean file and records where it came from', async () => {
    const { save, onSaved } = setup([HEADER, r(0), r(1), r(2)].join('\n'));
    await readAndAnalyze();
    expect(screen.getByText('Düzeltme gerekmiyor.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [meta, series] = save.mock.calls[0]!;
    expect(meta).toMatchObject({
      id: 'ds-1',
      instrument: 'EURUSD',
      baseTimeframe: '1m',
      priceType: 'BID',
      candleCount: 3,
      acceptedIssues: [],
      demo: false,
      source: {
        name: 'Dukascopy',
        fileName: 'SYNTHETIC_wizard.csv',
        sourceTimezone: 'UTC',
        importedAt: 1_000,
      },
    });
    expect(meta.contentHash).toBe(series.contentHash);
  });

  it('keeps Save disabled until the user accepts each required fix', async () => {
    const { save } = setup([HEADER, r(1), r(0), r(2)].join('\n'));
    await readAndAnalyze();
    const saveButton = screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /zamana göre sırala/i }));
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]![0].acceptedIssues).toEqual(['SORT_BY_TIME']);
  });

  it('blocks saving when duplicates disagree on prices', async () => {
    setup([HEADER, r(0), r(0, '1.08501'), r(1)].join('\n'));
    await readAndAnalyze();
    expect(screen.getByText(/farklı fiyatlarla tekrar eden/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('saves nothing when cancelled', async () => {
    const { save, onClose } = setup([HEADER, r(0)].join('\n'));
    fireEvent.click(screen.getByRole('button', { name: 'İptal' }));
    expect(onClose).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
