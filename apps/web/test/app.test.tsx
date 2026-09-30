import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';
import type { MarketRepo } from '../src/storage/market-repo';

const emptyRepo: MarketRepo = {
  listDatasets: async () => [],
  loadSeries: async () => {
    throw new Error('no data');
  },
  saveDataset: async () => {},
  deleteDataset: async () => {},
};

describe('App shell', () => {
  it('renders the application title', async () => {
    render(<App repo={emptyRepo} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Trading Research Workstation',
    );
  });

  it('shows only the empty state when no data has been imported (rule 1)', async () => {
    render(<App repo={emptyRepo} />);
    expect(await screen.findByText('Henüz veri yok')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CSV içe aktar' })).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
    expect(screen.queryByTestId('stats')).toBeNull();
  });
});
