import { describe, expect, it } from 'vitest';
import { glossaryById } from '../src/content/glossary';
import { TERMS } from '../src/content/terms';

describe('TERMS (contextual help ids used in the UI)', () => {
  it.each(Object.entries(TERMS))('%s → "%s" exists in docs/ogrenme/sozluk.md', (_, id) => {
    expect(glossaryById(id), `missing glossary entry: ${id}`).toBeDefined();
  });
});
