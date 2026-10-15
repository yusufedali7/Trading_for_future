import { useCallback, useEffect, useState } from 'react';
import { findConflicts, type DraftConflict, type IanaTz } from '@trw/engine';
import { formatTime } from '../../format';
import { NoteError, parseResearchNote, type ResearchNote } from '../research-notes/parse';
import { ResearchNotePanel } from '../research-notes/ResearchNotePanel';
import { tr } from '../../i18n/tr';
import type { ResearchRepo, StoredDraft, StoredResearchNote } from '../../storage/strategy-repo';
import { isWebhookUrl, type NotifyResult } from './webhook';

const t = tr.signals;
const rt = tr.researchNotes;

export interface SignalsPageProps {
  research: ResearchRepo;
  displayTz: IanaTz;
  now: () => number;
  /** D76: where new drafts are POSTed; null = off. */
  webhookUrl: string | null;
  onWebhookUrl: (url: string | null) => void;
  /** Last delivery (draft notices or a test), shown so failures are never silent. */
  notify: (NotifyResult & { at: number }) | null;
  onTest: () => Promise<void>;
}

function WebhookSettings(p: SignalsPageProps) {
  const w = t.webhook;
  const [url, setUrl] = useState(p.webhookUrl ?? '');
  const valid = isWebhookUrl(url.trim());
  return (
    <section className="panel stack" aria-labelledby="webhook-title">
      <h3 id="webhook-title">{w.title}</h3>
      <p className="hint">{w.intro}</p>
      <p className="hint">{w.share}</p>
      <p>{p.webhookUrl ? w.on(p.webhookUrl) : w.off}</p>
      <div className="field-row">
        <label className="inline-field">
          <span>{w.url}</span>
          <input
            type="url"
            value={url}
            placeholder="http://localhost:5678/webhook/..."
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!valid}
          onClick={() => p.onWebhookUrl(url.trim())}
        >
          {w.save}
        </button>
        {p.webhookUrl && (
          <>
            <button type="button" className="btn" onClick={() => void p.onTest()}>
              {w.test}
            </button>
            <button type="button" className="btn" onClick={() => p.onWebhookUrl(null)}>
              {w.clear}
            </button>
          </>
        )}
      </div>
      {url.trim() !== '' && !valid && <p className="warn-text">{w.invalid}</p>}
      <p className="hint">{w.cors}</p>
      {p.notify && (
        <p className="muted-inline">
          {w.result(formatTime(p.notify.at, p.displayTz), p.notify.sent, p.notify.failed)}
        </p>
      )}
      {p.notify?.error && <p className="warn-text">{w.error(p.notify.error)}</p>}
    </section>
  );
}

/** JSON file picker for a research-note/v1 (D80): rejects by name, never saves on failure. */
function NoteImport({ onImport }: { onImport: (note: ResearchNote) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="panel stack" aria-labelledby="note-import-title">
      <h3 id="note-import-title">{rt.importLabel}</h3>
      <p className="hint">{rt.importHint}</p>
      <input
        type="file"
        accept="application/json"
        aria-label={rt.importLabel}
        data-testid="import-note-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void file
            .text()
            .then((text) => parseResearchNote(text))
            .then((note) => {
              setError(null);
              return onImport(note);
            })
            .catch((err: unknown) => {
              setError(
                err instanceof NoteError
                  ? (rt.errors[err.code]?.(err.field) ?? err.code)
                  : String(err),
              );
            });
        }}
      />
      {error && (
        <p className="blocker" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** The note for `instrument` with the latest `asOf` that is not after `atMs` (UTC date-only). */
function nearestNote(
  notes: readonly StoredResearchNote[],
  instrument: string,
  atMs: number,
): StoredResearchNote | null {
  const cutoff = new Date(atMs).toISOString().slice(0, 10);
  let best: StoredResearchNote | null = null;
  for (const n of notes) {
    if (n.note.instrument !== instrument || n.note.asOf > cutoff) continue;
    if (!best || n.note.asOf > best.note.asOf) best = n;
  }
  return best;
}

/** One entry per instrument, its newest note (`notes` is already newest-`asOf`-first). */
function newestPerInstrument(notes: readonly StoredResearchNote[]): StoredResearchNote[] {
  const seen = new Set<string>();
  const out: StoredResearchNote[] = [];
  for (const n of notes) {
    if (seen.has(n.note.instrument)) continue;
    seen.add(n.note.instrument);
    out.push(n);
  }
  return out;
}

/** Live-refreshes itself so "expired" status and conflicts stay current while the page is open. */
const REFRESH_MS = 15_000;

export function SignalsPage(p: SignalsPageProps) {
  const [drafts, setDrafts] = useState<StoredDraft[] | null>(null);
  const [notes, setNotes] = useState<StoredResearchNote[] | null>(null);
  const [clock, setClock] = useState(p.now());

  useEffect(() => {
    let cancelled = false;
    const load = () => void p.research.listDrafts().then((d) => !cancelled && setDrafts(d));
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [p.research]);

  const refreshNotes = useCallback(
    () => p.research.listResearchNotes().then(setNotes),
    [p.research],
  );
  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    const id = setInterval(() => setClock(p.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, [p.now]);

  const conflicts: readonly DraftConflict[] = drafts
    ? findConflicts(
        drafts.map((d) => d.draft),
        clock,
      )
    : [];
  const conflictPartner = new Map<string, string>();
  for (const c of conflicts) {
    conflictPartner.set(c.a, c.b);
    conflictPartner.set(c.b, c.a);
  }
  const nameOf = new Map((drafts ?? []).map((d) => [d.draft.id, d.strategyName]));

  return (
    <div className="signals-page stack">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>
      <WebhookSettings {...p} />
      <NoteImport
        onImport={async (note) => {
          await p.research.saveResearchNote({
            id: `${note.instrument}:${note.asOf}`,
            note,
            importedAt: p.now(),
          });
          await refreshNotes();
        }}
      />
      {drafts === null && <p className="muted">{tr.app.loading}</p>}
      {drafts !== null && drafts.length === 0 && (
        <>
          <p className="muted">{t.empty}</p>
          {notes && notes.length > 0 && (
            <div className="stack">
              {newestPerInstrument(notes).map((n) => (
                <div key={n.id} className="stack">
                  <p className="muted-inline">{rt.noteFor(n.note.instrument)}</p>
                  <ResearchNotePanel note={n} displayTz={p.displayTz} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ul className="levels">
        {(drafts ?? []).map((sd) => {
          const d = sd.draft;
          const active = d.expiresAt > clock;
          const conflictingWith = conflictPartner.get(d.id);
          const note = notes ? nearestNote(notes, d.instrument, d.createdAt) : null;
          return (
            <li key={d.id} className="panel stack">
              <div className="field-row">
                <strong>{sd.strategyName}</strong>
                <span className="muted-inline">
                  {d.instrument} · {t.direction[d.direction]}
                </span>
                <span className={active ? 'badge' : 'muted-inline'}>
                  {active ? t.active : t.expired}
                </span>
                {conflictingWith && (
                  <span className="warn-text">
                    {t.conflict}: {t.conflictWith(nameOf.get(conflictingWith) ?? conflictingWith)}
                  </span>
                )}
              </div>
              <p className="hint">
                {t.entry} {d.order.price ?? d.order.referencePrice} · {t.stop} {d.order.stop} ·{' '}
                {t.target} {d.order.target} · {t.lots} {d.lots} · {t.risk(d.riskAmount)}
              </p>
              <p className="hint">
                {t.createdAt}: {formatTime(d.createdAt, p.displayTz)} · {t.expiresAt}:{' '}
                {formatTime(d.expiresAt, p.displayTz)}
              </p>
              <p className="hint">
                {t.conditions}: {d.conditions.map((c) => c.stepId).join(' ✓, ')}
                {d.conditions.length > 0 ? ' ✓' : ''}
              </p>
              {note && <ResearchNotePanel note={note} displayTz={p.displayTz} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
