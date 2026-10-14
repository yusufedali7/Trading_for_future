import { useEffect, useMemo, useRef, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { GLOSSARY, slugify } from '../../content/glossary';
import { tr } from '../../i18n/tr';

const t = tr.learn.glossary;
const SECTIONS = [...new Set(GLOSSARY.map((e) => e.section))];

export function GlossaryPage({ selectedId }: { selectedId: string | null }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const selectedRef = useRef<HTMLElement | null>(null);

  const shown = useMemo(() => {
    const q = slugify(query);
    return GLOSSARY.filter(
      (e) => (!section || e.section === section) && (!q || slugify(e.term).includes(q)),
    );
  }, [query, section]);

  useEffect(() => {
    if (!selectedId) return;
    setQuery('');
    setSection('');
  }, [selectedId]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'center' });
  }, [selectedId, shown]);

  return (
    <div className="journal-page glossary-page">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>
      <div className="field-row">
        <input
          type="search"
          placeholder={t.search}
          aria-label={t.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label={t.section} value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">{t.allSections}</option>
          {SECTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="muted-inline">{t.count(shown.length)}</span>
      </div>
      {shown.length === 0 && <p className="muted">{t.none}</p>}
      <div>
        {shown.map((e) => {
          const selected = e.id === selectedId;
          return (
            <article
              key={e.id}
              id={`glossary-${e.id}`}
              className="glossary-entry"
              data-selected={selected}
              ref={selected ? (el) => void (selectedRef.current = el) : undefined}
            >
              <h4>{e.term}</h4>
              <Markdown text={e.body} />
              {e.inApp && (
                <p className="hint">
                  {tr.learn.term.inApp} {e.inApp}
                </p>
              )}
              <p className="muted-inline">{e.section}</p>
            </article>
          );
        })}
      </div>
      <p className="hint">{t.source}</p>
    </div>
  );
}
