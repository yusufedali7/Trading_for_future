import { tr } from '../../i18n/tr';
import { ConceptsPage, type ConceptsPageProps } from '../concepts/ConceptsPage';
import { GlossaryPage } from './GlossaryPage';

const t = tr.learn;

export type LearnTab = keyof typeof t.tabs;
const TABS = Object.keys(t.tabs) as LearnTab[];

export interface LearnPageProps {
  tab: LearnTab;
  onTab: (tab: LearnTab) => void;
  /** Glossary entry to highlight, set when a contextual term asked to open the glossary. */
  glossaryFocus: string | null;
  concepts: ConceptsPageProps;
}

/** The education hub (D71): concept library and glossary under one roof. */
export function LearnPage(p: LearnPageProps) {
  return (
    <div className="learn-page">
      <div className="learn-tabs" role="group" aria-label={t.title}>
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            className="btn"
            aria-pressed={p.tab === k}
            onClick={() => p.onTab(k)}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>
      {p.tab === 'CONCEPTS' && <ConceptsPage {...p.concepts} />}
      {p.tab === 'GLOSSARY' && <GlossaryPage selectedId={p.glossaryFocus} />}
    </div>
  );
}
