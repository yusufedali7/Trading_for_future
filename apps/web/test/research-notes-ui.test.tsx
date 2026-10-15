import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SignalDraft } from '@trw/engine';
import { NOTE_DISCLAIMER, type ResearchNote } from '../src/features/research-notes/parse';
import { ResearchNotePanel } from '../src/features/research-notes/ResearchNotePanel';
import { SignalsPage } from '../src/features/live/SignalsPage';
import { createMemoryResearchRepo, type StoredDraft } from '../src/storage/strategy-repo';

const T0 = Date.parse('2026-10-15T09:00:00Z');

/** SYNTHETIC: a stored signal draft as D70 writes it (mirrors webhook.test.ts's fixture). */
function storedDraft(instrument: string): StoredDraft {
  const draft: SignalDraft = {
    id: `${instrument}-draft`,
    strategyId: 's1',
    strategyVersion: 2,
    instrument,
    direction: 'LONG',
    setupId: 'setup-1',
    conditions: [{ stepId: 'sweep' }] as unknown as SignalDraft['conditions'],
    order: {
      direction: 'LONG',
      type: 'LIMIT',
      placedAt: T0,
      referencePrice: 1.1,
      price: 1.0995,
      stop: 1.098,
      target: 1.102,
      expiresAt: T0 + 3_600_000,
    },
    lots: 0.33,
    riskAmount: 50,
    createdAt: T0,
    expiresAt: T0 + 3_600_000,
  };
  return { id: draft.id, strategyName: 'Londra süpürme', draft, savedAt: T0 };
}

// SYNTHETIC: a minimal valid research-note/v1.
function researchNote(overrides: Partial<ResearchNote> = {}): ResearchNote {
  return {
    schema: 'research-note/v1',
    instrument: 'EURUSD',
    asOf: '2026-10-14',
    generatedAt: '2026-10-14T09:12:00Z',
    reports: { technical: 'teknik rapor metni' },
    debate: { rounds: [{ bull: 'alim gorusu', bear: 'satim gorusu' }] },
    modelInfo: { llmProvider: 'anthropic', quickModel: 'claude-haiku-4-5' },
    disclaimer: NOTE_DISCLAIMER,
    ...overrides,
  };
}

function signalsPage(research = createMemoryResearchRepo()) {
  render(
    <SignalsPage
      research={research}
      displayTz="UTC"
      now={() => 1_000}
      webhookUrl={null}
      onWebhookUrl={() => {}}
      notify={null}
      onTest={async () => {}}
    />,
  );
  return research;
}

async function importFile(json: unknown) {
  const file = new File([JSON.stringify(json)], 'note.json', { type: 'application/json' });
  const input = screen.getByTestId('import-note-file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ResearchNotePanel', () => {
  it('never renders report text as HTML', () => {
    const note = researchNote({ reports: { technical: '<img src=x onerror="alert(1)">' } });
    render(<ResearchNotePanel note={{ id: 'x', note, importedAt: 1 }} displayTz="UTC" />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeTruthy();
  });
});

describe('SignalsPage research notes (D80)', () => {
  it('shows no research note panel until one has been imported', async () => {
    signalsPage();
    await waitFor(() => expect(screen.getByText(/Henüz sinyal taslağı yok/)).toBeTruthy());
    expect(document.querySelector('.research-note')).toBeNull();
  });

  it('imports a valid file and shows it with its fixed warning', async () => {
    const research = signalsPage();
    await waitFor(() => expect(screen.getByText(/Henüz sinyal taslağı yok/)).toBeTruthy());

    await importFile(researchNote());

    const summary = await screen.findByText(/Araştırma notu \(AI özeti\)/);
    fireEvent.click(summary);
    expect(screen.getByText(/backtest edilmiş bir istatistik değildir/)).toBeTruthy();
    expect(screen.getByText('teknik rapor metni')).toBeTruthy();
    expect(await research.listResearchNotes()).toHaveLength(1);
  });

  it('rejects a file with an unknown field, naming it, and saves nothing', async () => {
    const research = signalsPage();
    await waitFor(() => expect(screen.getByText(/Henüz sinyal taslağı yok/)).toBeTruthy());

    await importFile({ ...researchNote(), decision: 'AL' });

    await waitFor(() => expect(screen.getByText('Beklenmeyen alan: decision')).toBeTruthy());
    expect(await research.listResearchNotes()).toHaveLength(0);
  });

  it('still shows an imported note when drafts exist for a different instrument (D80 finding)', async () => {
    const research = createMemoryResearchRepo();
    await research.saveDrafts([storedDraft('GBPUSD')]);
    signalsPage(research);
    await waitFor(() => expect(screen.getByText(/GBPUSD/)).toBeTruthy());

    // EURUSD has no draft, so the old logic (notes shown only when drafts.length === 0, or
    // attached to a matching draft) never rendered this note anywhere.
    await importFile(researchNote({ instrument: 'EURUSD' }));

    expect(await screen.findByText(/EURUSD için en yeni araştırma notu/)).toBeTruthy();
  });
});
