import type { LessonAction } from '../../content/lessons';
import { tr } from '../../i18n/tr';
import { ConceptsPage, type ConceptsPageProps } from '../concepts/ConceptsPage';
import { GlossaryPage } from './GlossaryPage';
import { LearningPathPage } from './LearningPathPage';

const t = tr.learn;

export type LearnTab = keyof typeof t.tabs;
const TABS = Object.keys(t.tabs) as LearnTab[];

export interface LearnPageProps {
  tab: LearnTab;
  onTab: (tab: LearnTab) => void;
  /** Glossary entry to highlight, set when a contextual term asked to open the glossary. */
  glossaryFocus: string | null;
  concepts: ConceptsPageProps;
  path: {
    completed: readonly string[];
    selectedId: string;
    onSelect: (id: string) => void;
    onToggleComplete: (id: string) => void;
    onAction: (a: LessonAction) => void;
  };
}

/** The education hub (D71, D73): learning path, concept library and glossary under one roof. */
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
      {p.tab === 'PATH' && <LearningPathPage {...p.path} />}
      {p.tab === 'CONCEPTS' && <ConceptsPage {...p.concepts} />}
      {p.tab === 'GLOSSARY' && <GlossaryPage selectedId={p.glossaryFocus} />}
    </div>
  );
}
