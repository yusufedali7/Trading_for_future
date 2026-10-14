import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../src/components/Markdown';

describe('Markdown (safe subset for glossary/lesson text)', () => {
  it('renders bold, italic and inline code as elements', () => {
    const { container } = render(<Markdown text="**EURUSD** ve *kote* para, `registry.ts`" />);
    expect(container.querySelector('strong')?.textContent).toBe('EURUSD');
    expect(container.querySelector('em')?.textContent).toBe('kote');
    expect(container.querySelector('code')?.textContent).toBe('registry.ts');
  });

  it('groups "- " lines into one list and blank lines into paragraphs', () => {
    const { container } = render(
      <Markdown text={'Giriş satırı.\n- bir\n- **iki**\n\nSon paragraf.'} />,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'bir',
      'iki',
    ]);
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Giriş satırı.',
      'Son paragraf.',
    ]);
  });

  it('never interprets raw HTML', () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> **a**'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
