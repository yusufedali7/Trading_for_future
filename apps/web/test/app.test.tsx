import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App, type AppProps } from '../src/App';
import { createInProcessImporter } from '../src/import/importer';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryRepo } from '../src/storage/memory-repo';

function renderApp(overrides: Partial<AppProps> = {}) {
  const props: AppProps = {
    repo: createMemoryRepo(),
    prefs: createMemoryPrefsRepo(),
    createImporter: createInProcessImporter,
    ChartComponent: () => <div data-testid="chart" />,
    ...overrides,
  };
  render(<App {...props} />);
  return props;
}

// SYNTHETIC CSV used to drive the import flow.
const CSV = [
  'Gmt time,Open,High,Low,Close,Volume',
  '06.01.2026 15:00:00.000,1.08500,1.08520,1.08490,1.08510,1',
  '06.01.2026 15:01:00.000,1.08510,1.08530,1.08505,1.08525,2',
  '06.01.2026 15:02:00.000,1.08525,1.08540,1.08515,1.08520,3',
].join('\n');

describe('App shell', () => {
  it('renders the application title', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Trading Research Workstation',
    );
  });

  it('shows only the empty state when no data has been imported (rule 1)', async () => {
    renderApp();
    expect(await screen.findByText('Henüz veri yok')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CSV içe aktar' })).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
    expect(screen.queryByTestId('stats')).toBeNull();
  });

  it('opens the import wizard from the empty state', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'CSV içe aktar' }));
    expect(screen.getByRole('dialog', { name: 'CSV içe aktar' })).toBeTruthy();
  });

  it('shows the chart once a dataset has been imported', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'CSV içe aktar' }));
    fireEvent.change(screen.getByLabelText('Dosya'), {
      target: { files: [new File([CSV], 'SYNTHETIC_app.csv')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dosyayı oku' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Analiz et' }));
    await screen.findByRole('heading', { name: 'Doğrulama raporu' });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await vi.waitFor(() => expect(screen.getByTestId('chart')).toBeTruthy());
    expect(screen.queryByText('Henüz veri yok')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
