import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlossaryNav, Term } from '../src/components/Term';

describe('Term (contextual glossary help)', () => {
  it('shows the glossary definition when clicked', () => {
    render(<Term id="pip">pip</Term>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'pip' }));
    const pop = screen.getByRole('dialog');
    expect(pop.textContent).toContain('Pip');
    expect(pop.textContent).toContain('Fiyat hareketini ölçmek için');
  });

  it('closes again on a second click', () => {
    render(<Term id="pip">pip</Term>);
    const btn = screen.getByRole('button', { name: 'pip' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers "open in glossary" only when the app provides navigation', () => {
    const open = vi.fn();
    render(
      <GlossaryNav.Provider value={open}>
        <Term id="pip">pip</Term>
      </GlossaryNav.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'pip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sözlükte aç' }));
    expect(open).toHaveBeenCalledWith('pip');
  });

  it('renders plain text for an unknown id instead of failing', () => {
    render(<Term id="yok-boyle-bir-terim">bilinmeyen</Term>);
    expect(screen.getByText('bilinmeyen')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
