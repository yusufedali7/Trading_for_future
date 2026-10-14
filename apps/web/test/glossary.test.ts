import { describe, expect, it } from 'vitest';
import { GLOSSARY, glossaryById, parseGlossary, slugify } from '../src/content/glossary';

// SYNTHETIC: a hand-written miniature of docs/ogrenme/sozluk.md's layout.
const md = `# Sözlük

Giriş paragrafı, terim değil.

---

## Fiyat ve birimler

### Pip
Fiyat hareketini ölçmek için birim.
- **EURUSD:** 1 pip = 0.0001.

*Neden önemli:* Stop mesafesi pip ile ölçülür.
*Uygulamada:* registry.ts içinde tanımlı.

### Çekiç (Hammer)
Uzun alt gölgeli mum.

---

## Veri

### CSV
Virgülle ayrılmış dosya.

### CSV
İkinci kez geçen başlık.
`;

describe('parseGlossary', () => {
  const entries = parseGlossary(md);

  it('turns every ### heading into one entry under its ## section', () => {
    expect(entries.map((e) => [e.section, e.term])).toEqual([
      ['Fiyat ve birimler', 'Pip'],
      ['Fiyat ve birimler', 'Çekiç (Hammer)'],
      ['Veri', 'CSV'],
      ['Veri', 'CSV'],
    ]);
  });

  it('keeps the body but moves the "Uygulamada" line into inApp', () => {
    const pip = entries[0]!;
    expect(pip.body).toContain('Fiyat hareketini ölçmek için birim.');
    expect(pip.body).toContain('*Neden önemli:*');
    expect(pip.body).not.toContain('Uygulamada');
    expect(pip.inApp).toBe('registry.ts içinde tanımlı.');
    expect(entries[1]!.inApp).toBeUndefined();
  });

  it('ends a body at the --- separator', () => {
    expect(entries[1]!.body).toBe('Uzun alt gölgeli mum.');
  });

  it('gives each entry a unique ascii id, suffixing repeated headings', () => {
    expect(entries.map((e) => e.id)).toEqual(['pip', 'cekic-hammer', 'csv', 'csv-2']);
  });
});

describe('slugify', () => {
  it('maps Turkish letters to ascii and collapses punctuation', () => {
    expect(slugify('R (risk birimi)')).toBe('r-risk-birimi');
    expect(slugify('Kazanma oranı ve beklenen değer')).toBe('kazanma-orani-ve-beklenen-deger');
    expect(slugify('İşlem günü')).toBe('islem-gunu');
  });
});

describe('the real glossary (docs/ogrenme/sozluk.md)', () => {
  it('is loaded, non-trivial and has unique ids', () => {
    expect(GLOSSARY.length).toBeGreaterThan(100);
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length);
  });

  it('can be looked up by id', () => {
    expect(glossaryById('pip')?.term).toBe('Pip');
    expect(glossaryById('r-risk-birimi')?.term).toBe('R (risk birimi)');
    expect(glossaryById('yok-boyle-bir-terim')).toBeUndefined();
  });
});
