import { useEffect, useState } from 'react';
import { findConflicts, type DraftConflict, type IanaTz } from '@trw/engine';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { ResearchRepo, StoredDraft } from '../../storage/strategy-repo';

const t = tr.signals;

export interface SignalsPageProps {
  research: ResearchRepo;
  displayTz: IanaTz;
  now: () => number;
}

/** Live-refreshes itself so "expired" status and conflicts stay current while the page is open. */
const REFRESH_MS = 15_000;

export function SignalsPage(p: SignalsPageProps) {
  const [drafts, setDrafts] = useState<StoredDraft[] | null>(null);
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
      {drafts === null && <p className="muted">{tr.app.loading}</p>}
      {drafts !== null && drafts.length === 0 && <p className="muted">{t.empty}</p>}
      <ul className="levels">
        {(drafts ?? []).map((sd) => {
          const d = sd.draft;
          const active = d.expiresAt > clock;
          const conflictingWith = conflictPartner.get(d.id);
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
