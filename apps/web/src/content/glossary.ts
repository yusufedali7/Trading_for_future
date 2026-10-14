/**
 * Education area (D40/D71): the in-app glossary. Its single source is docs/ogrenme/sozluk.md,
 * which is updated every milestone; this module only parses it, so the two never drift.
 */
import sozluk from '../../../../docs/ogrenme/sozluk.md?raw';

export interface GlossaryEntry {
  id: string;
  term: string;
  section: string;
  /** Markdown body without the "*Uygulamada:*" line. */
  body: string;
  /** Where the concept shows up in this app (the "*Uygulamada:*" line), if the entry has one. */
  inApp?: string;
}

const TR_ASCII: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

export function slugify(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (ch) => TR_ASCII[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const IN_APP = /^\*Uygulamada:\*\s*/;

export function parseGlossary(md: string): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  const seen = new Map<string, number>();
  let section = '';
  let current: { term: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const base = slugify(current.term);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const inAppLines = current.lines.filter((l) => IN_APP.test(l));
    const body = current.lines
      .filter((l) => !IN_APP.test(l))
      .join('\n')
      .trim();
    entries.push({
      id: n === 1 ? base : `${base}-${n}`,
      term: current.term,
      section,
      body,
      ...(inAppLines.length > 0
        ? { inApp: inAppLines.map((l) => l.replace(IN_APP, '')).join(' ') }
        : {}),
    });
    current = null;
  };

  for (const line of md.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      flush();
      current = { term: line.slice(4).trim(), lines: [] };
    } else if (line.startsWith('## ')) {
      flush();
      section = line.slice(3).trim();
    } else if (line.startsWith('# ') || line.trim() === '---') {
      flush();
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return entries;
}

export const GLOSSARY: readonly GlossaryEntry[] = parseGlossary(sozluk);

const BY_ID = new Map(GLOSSARY.map((e) => [e.id, e]));

export function glossaryById(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}
