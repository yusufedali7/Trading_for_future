import type { IanaTz } from '@trw/engine';
import { Markdown } from '../../components/Markdown';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { StoredResearchNote } from '../../storage/strategy-repo';

const t = tr.researchNotes;

/** Stable order regardless of the JSON's own key order. */
const REPORT_SECTIONS = ['technical', 'news', 'sentiment', 'fundamentals'] as const;

/**
 * An imported research-note/v1 (D79/D80): analyst reports and a boğa/ayı debate from a separate
 * Python tool (tools/research-notes), never a decision or a probability (Kural 6/9) - the fixed
 * warning below is never omitted or made dismissable.
 */
export function ResearchNotePanel({
  note: stored,
  displayTz,
}: {
  note: StoredResearchNote;
  displayTz: IanaTz;
}) {
  const n = stored.note;
  return (
    <details className="panel research-note">
      <summary>
        {t.title} · {n.instrument} · {n.asOf}
      </summary>
      <div className="stack">
        <p className="warn-text">{t.warning}</p>
        {REPORT_SECTIONS.map((key) =>
          n.reports[key] ? (
            <div key={key}>
              <h4>{t.sections[key]}</h4>
              <Markdown text={n.reports[key]!} />
            </div>
          ) : null,
        )}
        {n.debate.rounds.length > 0 && (
          <div>
            <h4>{t.debate}</h4>
            {n.debate.rounds.map((r, i) => (
              <div key={i} className="stack">
                <p className="muted-inline">
                  {t.round(i + 1)} · {t.bull}
                </p>
                <Markdown text={r.bull} />
                <p className="muted-inline">{t.bear}</p>
                <Markdown text={r.bear} />
              </div>
            ))}
          </div>
        )}
        <p className="muted-inline">{t.model(n.modelInfo.llmProvider, n.modelInfo.quickModel)}</p>
        {n.usage && (
          <p className="muted-inline">{t.usage(n.usage.inputTokens, n.usage.outputTokens)}</p>
        )}
        <p className="hint">{t.importedAt(formatTime(stored.importedAt, displayTz))}</p>
      </div>
    </details>
  );
}
