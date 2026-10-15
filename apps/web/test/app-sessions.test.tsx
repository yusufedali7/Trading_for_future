import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { App } from '../src/App';
import type { ChartViewProps } from '../src/chart/types';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { idFromName } from '../src/features/sessions/SessionManager';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { createMemorySessionsRepo } from '../src/storage/sessions-repo';
import { createMemoryStrategyRepo } from '../src/storage/strategy-repo';
import { waitLong } from './helpers/wait';

// SYNTHETIC: 1m bars from Tue 2026-01-06 00:00Z to 12:00Z (ICT Asia range 01:00–05:00Z inside).
const rows = Array.from({ length: 720 }, (_, i) => {
  const r = (x: number) => Math.round(x * 1e5) / 1e5;
  const mid = r(1.1 + 0.001 * Math.sin((2 * Math.PI * i) / 90));
  return {
    t: Date.parse('2026-01-06T00:00:00Z') + i * 60_000,
    o: mid,
    h: r(mid + 0.0002),
    l: r(mid - 0.0002),
    c: mid,
  };
});

let latest: ChartViewProps | null = null;
function FakeChart(p: ChartViewProps) {
  latest = p;
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
  const sessions = createMemorySessionsRepo();
  const strategies = createMemoryStrategyRepo();
  let id = 0;
  render(
    <App
      repo={repo}
      prefs={createMemoryPrefsRepo()}
      drawingsRepo={createMemoryDrawingsRepo()}
      journalRepo={createMemoryJournalRepo()}
      createImporter={createInProcessImporter}
      candleSource={createInProcessCandleSource(repo)}
      sessionsRepo={sessions}
      strategyRepo={strategies}
      ChartComponent={FakeChart}
      now={() => 1_000}
      newId={() => `id-${++id}`}
    />,
  );
  await waitLong(() => expect(screen.getByTestId('count')).toBeTruthy());
  return { sessions, strategies };
}

const manager = () => within(screen.getByRole('dialog', { name: 'Seanslarım' }));

async function addIctAsia() {
  fireEvent.click(screen.getByRole('button', { name: /^Seanslar \(/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Seanslar…' }));
  fireEvent.click(manager().getByRole('button', { name: /ICT Asya aralığı/ }));
  fireEvent.click(manager().getByRole('button', { name: 'Kaydet' }));
  await waitLong(() => expect(manager().getByText(/ICT_ASIA/)).toBeTruthy());
  fireEvent.click(manager().getByRole('button', { name: 'Kapat' }));
}

describe('user sessions', () => {
  it('derives an ASCII id from a Turkish name', () => {
    expect(idFromName('Londra açılış öncesi')).toBe('LONDRA_ACILIS_ON');
    expect(idFromName('ICT Asya aralığı')).toBe('ICT_ASYA_ARALIGI');
  });

  it('adds a preset session, shows it on the chart and as a toggle, and stores it', async () => {
    const { sessions } = await setup();
    await addIctAsia();
    expect((await sessions.list()).map((s) => [s.id, s.tz, s.start, s.end])).toEqual([
      ['ICT_ASIA', 'America/New_York', '20:00', '00:00'],
    ]);
    await waitLong(() =>
      expect(latest!.sessions.some((s) => s.sessionId === 'ICT_ASIA')).toBe(true),
    );
    expect(latest!.sessionStyles).toEqual({
      ICT_ASIA: { name: 'ICT Asya aralığı', color: '#c9a227' },
    });
    const toggle = screen.getByRole('button', { name: 'ICT Asya aralığı' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(latest!.sessions.some((s) => s.sessionId === 'ICT_ASIA')).toBe(false);
  });

  it('rejects an invalid definition with a reason', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: /^Seanslar \(/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Seanslar…' }));
    fireEvent.click(manager().getByRole('button', { name: 'Yeni seans' }));
    const form = within(manager().getByRole('form', { name: 'Yeni seans' }));
    fireEvent.change(form.getByLabelText('Ad'), { target: { value: 'Asya' } });
    expect(form.queryByRole('alert')).toBeNull(); // id ASYA is free
    fireEvent.change(form.getByLabelText(/Kısa kimlik/), { target: { value: 'ASIA' } });
    expect(form.getByRole('alert').textContent).toMatch(/ayrılmış/);
    expect(form.getByRole('button', { name: 'Kaydet' })).toHaveProperty('disabled', true);
  });

  it('offers its levels in the strategy builder and copies the session into the version', async () => {
    const { strategies } = await setup();
    await addIctAsia();
    fireEvent.click(screen.getByRole('button', { name: 'Strateji' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yeni strateji' }));
    const b = within(screen.getByRole('form', { name: 'Kurallar' }));
    fireEvent.change(b.getByLabelText('Ad'), { target: { value: 'ICT Asya dibi süpürme' } });
    fireEvent.click(b.getByLabelText('ICT Asya aralığı D'));
    fireEvent.click(b.getByRole('button', { name: 'Versiyonu kaydet' }));
    await waitLong(() => expect(screen.getByRole('region', { name: 'v1' })).toBeTruthy());
    const [v] = await strategies.listVersions('id-1');
    expect(v!.spec.steps[0]).toMatchObject({ levels: ['ICT_ASIA_LOW'] });
    expect(v!.spec.sessions).toEqual([
      {
        id: 'ICT_ASIA',
        name: 'ICT Asya aralığı',
        tz: 'America/New_York',
        start: '20:00',
        end: '00:00',
        days: [7, 1, 2, 3, 4],
        version: 1,
      },
    ]);
    expect(screen.getByText(/seviye: ICT Asya aralığı D/)).toBeTruthy();
  });
});
