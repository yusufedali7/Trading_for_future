import { Markdown } from '../../components/Markdown';
import { Term } from '../../components/Term';
import { CONCEPTS } from '../../content/concepts';
import { glossaryById } from '../../content/glossary';
import { LESSON_MODULES, LESSONS, type LessonAction } from '../../content/lessons';
import { tr } from '../../i18n/tr';

const t = tr.learn.path;

function actionLabel(a: LessonAction): string {
  switch (a.kind) {
    case 'OPEN_GLOSSARY':
      return t.action.glossary(glossaryById(a.term)?.term ?? a.term);
    case 'OPEN_CONCEPT':
      return t.action.concept(CONCEPTS.find((c) => c.id === a.concept)?.name ?? a.concept);
    case 'OPEN_CHART_LAYER':
      return t.action.layer(tr.features.layers[a.layer]);
    case 'OPEN_VIEW':
      return t.action.view(tr.journalPage.nav[a.view]);
  }
}

export interface LearningPathPageProps {
  completed: readonly string[];
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onAction: (a: LessonAction) => void;
}

/** The learning path (D73): ordered lessons wired to the glossary, concepts and app screens. */
export function LearningPathPage(p: LearningPathPageProps) {
  const done = new Set(p.completed);
  const lesson = LESSONS.find((l) => l.id === p.selectedId) ?? LESSONS[0]!;
  const doneCount = LESSONS.filter((l) => done.has(l.id)).length;
  return (
    <div className="journal-page learning-path">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>
      <p className="muted-inline">{t.progress(doneCount, LESSONS.length)}</p>
      {doneCount === LESSONS.length && <p className="hint">{t.allDone}</p>}
      <div className="concepts-layout">
        <nav className="concept-list" aria-label={t.modules}>
          {LESSON_MODULES.map((m) => (
            <div key={m.id} className="lesson-module">
              <span className="lesson-module-title">{m.title}</span>
              {m.lessons.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="concept-item"
                  aria-pressed={l.id === lesson.id}
                  onClick={() => p.onSelect(l.id)}
                >
                  <span>
                    {done.has(l.id) ? '✓ ' : ''}
                    {l.title}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <article className="concept-card panel" aria-label={lesson.title}>
          <h3>{lesson.title}</h3>
          <p>
            <strong>{t.goal}:</strong> {lesson.goal}
          </p>
          <Markdown text={lesson.body} />
          {lesson.terms.length > 0 && (
            <>
              <h4>{t.terms}</h4>
              <p className="lesson-terms">
                {lesson.terms.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ' · '}
                    <Term id={id}>{glossaryById(id)?.term ?? id}</Term>
                  </span>
                ))}
              </p>
            </>
          )}
          {lesson.actions.length > 0 && (
            <>
              <h4>{t.actions}</h4>
              <div className="field-row">
                {lesson.actions.map((a) => (
                  <button
                    key={`${a.kind}:${JSON.stringify(a)}`}
                    type="button"
                    className="btn"
                    onClick={() => p.onAction(a)}
                  >
                    {actionLabel(a)}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="field-row">
            {done.has(lesson.id) && <span className="badge">{t.done}</span>}
            <button
              type="button"
              className={done.has(lesson.id) ? 'btn' : 'btn btn-primary'}
              onClick={() => p.onToggleComplete(lesson.id)}
            >
              {done.has(lesson.id) ? t.undo : t.complete}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
