import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../src/content/glossary';
import { GlossaryPage } from '../src/features/learn/GlossaryPage';

const headings = () => screen.queryAllByRole('heading', { level: 4 }).map((h) => h.textContent);

describe('GlossaryPage', () => {
  it('lists every glossary entry by default', () => {
    render(<GlossaryPage selectedId={null} />);
    expect(headings()).toHaveLength(GLOSSARY.length);
    expect(screen.getByText(`${GLOSSARY.length} terim`)).toBeTruthy();
  });

  it('filters by term name, ignoring case and Turkish letters', () => {
    render(<GlossaryPage selectedId={null} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'PİP' } });
    expect(headings()).toContain('Pip');
    expect(headings()).toContain('Pip değeri');
    expect(headings()).not.toContain('Lot');
  });

  it('filters by section', () => {
    render(<GlossaryPage selectedId={null} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Pozisyon büyüklüğü' } });
    expect(headings()).toEqual(['Lot', 'Pip değeri', 'Kaldıraç ve marjin']);
  });

  it('says so when nothing matches', () => {
    render(<GlossaryPage selectedId={null} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(headings()).toEqual([]);
    expect(screen.getByText('Aramaya uyan terim yok.')).toBeTruthy();
  });

  it('marks the entry opened from a contextual term', () => {
    const { container } = render(<GlossaryPage selectedId="r-risk-birimi" />);
    const sel = container.querySelector('[data-selected="true"]') as HTMLElement;
    expect(within(sel).getByRole('heading').textContent).toBe('R (risk birimi)');
  });
});
