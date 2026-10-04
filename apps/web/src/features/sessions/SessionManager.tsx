import { useState, type FormEvent } from 'react';
import { isValidTimeZone, validateSessionDefinition, type LocalTime } from '@trw/engine';
import { tr } from '../../i18n/tr';
import type { UserSession } from '../../storage/sessions-repo';

const t = tr.sessions;
const NY = 'America/New_York';

/** Box colours for user sessions: no green/red (those mean direction), every box is labelled. */
export const USER_SESSION_COLORS = ['#c9a227', '#4fb3bf', '#d17fa8', '#a0a0ff', '#e08a4f'];

type Draft = Omit<UserSession, 'createdAt' | 'updatedAt' | 'version'>;

/** Common definitions (ICT terminology); not official, the user can change them. */
export const SESSION_PRESETS: Draft[] = [
  {
    id: 'ICT_ASIA',
    name: 'ICT Asya aralığı',
    tz: NY,
    start: '20:00',
    end: '00:00',
    days: [7, 1, 2, 3, 4],
    color: USER_SESSION_COLORS[0]!,
  },
  {
    id: 'LDN_KZ',
    name: 'Londra kill zone',
    tz: NY,
    start: '02:00',
    end: '05:00',
    days: [1, 2, 3, 4, 5],
    color: USER_SESSION_COLORS[1]!,
  },
  {
    id: 'NY_KZ',
    name: 'New York kill zone',
    tz: NY,
    start: '07:00',
    end: '10:00',
    days: [1, 2, 3, 4, 5],
    color: USER_SESSION_COLORS[2]!,
  },
];

/** "ICT Asya aralığı" → "ICT_ASYA_ARALIGI" (ASCII, upper case, max 16). */
export function idFromName(name: string): string {
  const ascii = name
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ascii.slice(0, 16).replace(/_+$/, '');
}

const blank = (n: number): Draft => ({
  id: '',
  name: '',
  tz: NY,
  start: '20:00',
  end: '00:00',
  days: [1, 2, 3, 4, 5],
  color: USER_SESSION_COLORS[n % USER_SESSION_COLORS.length]!,
});

export interface SessionManagerProps {
  sessions: readonly UserSession[];
  now: () => number;
  onSave: (s: UserSession, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function SessionManager(p: SessionManagerProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<UserSession | null>(null);
  const [idTouched, setIdTouched] = useState(false);

  const otherIds = p.sessions.filter((s) => s.id !== editing?.id).map((s) => s.id);
  const problems = draft
    ? validateSessionDefinition({ ...draft, version: 1 }, otherIds, isValidTimeZone)
    : [];
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const startNew = (from?: Draft) => {
    setEditing(null);
    setIdTouched(Boolean(from));
    setDraft(from ? { ...from } : blank(p.sessions.length));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || problems.length > 0) return;
    const at = p.now();
    const changed =
      editing &&
      (editing.tz !== draft.tz ||
        editing.start !== draft.start ||
        editing.end !== draft.end ||
        editing.days.join() !== draft.days.join());
    p.onSave(
      {
        ...draft,
        version: editing ? editing.version + (changed ? 1 : 0) : 1,
        createdAt: editing?.createdAt ?? at,
        updatedAt: at,
      },
      !editing,
    );
    setDraft(null);
    setEditing(null);
  };

  return (
    <div className="wizard session-manager" role="dialog" aria-labelledby="session-manager-title">
      <header className="wizard-header">
        <h2 id="session-manager-title">{t.managerTitle}</h2>
      </header>
      <div className="wizard-body">
        <p className="hint">{t.builtinNote}</p>
        {p.sessions.length === 0 && <p className="hint">{t.empty}</p>}
        <ul className="levels">
          {p.sessions.map((s) => (
            <li key={s.id} className="session-row">
              <span className="dot" style={{ background: s.color }} aria-hidden="true" />
              <span>
                {s.name} · <span className="mono">{s.id}</span> · {s.start}–{s.end} ({s.tz}) ·{' '}
                {s.days.map((d) => t.dayNames[d]).join(' ')}
              </span>
              <span className="spacer" />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(s);
                  setIdTouched(true);
                  setDraft({
                    id: s.id,
                    name: s.name,
                    tz: s.tz,
                    start: s.start,
                    end: s.end,
                    days: s.days,
                    color: s.color,
                  });
                }}
              >
                {t.edit}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => p.onDelete(s.id)}>
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
        <p className="hint">{t.copyNote}</p>

        {!draft && (
          <div className="stack">
            <h3>{t.presets}</h3>
            <div className="field-row wrap">
              {SESSION_PRESETS.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  className="btn"
                  disabled={p.sessions.some((s) => s.id === pr.id)}
                  onClick={() => startNew(pr)}
                >
                  {t.presetList[pr.id]}
                </button>
              ))}
              <button type="button" className="btn btn-primary" onClick={() => startNew()}>
                {t.add}
              </button>
            </div>
            <p className="hint">{t.presetNote}</p>
          </div>
        )}

        {draft && (
          <form className="stack" aria-label={editing ? t.edit : t.add} onSubmit={submit}>
            <label className="inline-field">
              <span>{t.name}</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) =>
                  set({
                    name: e.target.value,
                    ...(idTouched ? {} : { id: idFromName(e.target.value) }),
                  })
                }
              />
            </label>
            <label className="inline-field">
              <span>{t.id}</span>
              <input
                type="text"
                value={draft.id}
                disabled={Boolean(editing)}
                onChange={(e) => {
                  setIdTouched(true);
                  set({ id: e.target.value.toUpperCase() });
                }}
              />
            </label>
            <p className="hint">{t.idHint}</p>
            <label className="inline-field">
              <span>{t.tz}</span>
              <select value={draft.tz} onChange={(e) => set({ tz: e.target.value })}>
                {tr.displayTimezones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              <span>{t.start}</span>
              <input
                type="time"
                value={draft.start}
                onChange={(e) => set({ start: e.target.value as LocalTime })}
              />
            </label>
            <label className="inline-field">
              <span>{t.end}</span>
              <input
                type="time"
                value={draft.end}
                onChange={(e) => set({ end: e.target.value as LocalTime })}
              />
            </label>
            <p className="hint">{t.endHint}</p>
            <div className="field-row wrap" role="group" aria-label={t.days}>
              <span className="hint">{t.days}</span>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} className="check">
                  <input
                    type="checkbox"
                    checked={draft.days.includes(d)}
                    onChange={(e) =>
                      set({
                        days: e.target.checked
                          ? [...draft.days, d].sort((a, b) => (a % 7) - (b % 7))
                          : draft.days.filter((x) => x !== d),
                      })
                    }
                  />
                  <span>{t.dayNames[d]}</span>
                </label>
              ))}
            </div>
            <div className="field-row" role="group" aria-label={t.color}>
              {USER_SESSION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c }}
                  aria-label={c}
                  aria-pressed={draft.color === c}
                  onClick={() => set({ color: c })}
                />
              ))}
            </div>
            {problems.length > 0 && (
              <ul className="warn-box" role="alert">
                {problems.map((pr) => (
                  <li key={pr}>{t.problems[pr]}</li>
                ))}
              </ul>
            )}
            <div className="field-row">
              <button type="submit" className="btn btn-primary" disabled={problems.length > 0}>
                {t.save}
              </button>
              <button type="button" className="btn" onClick={() => setDraft(null)}>
                {t.cancel}
              </button>
            </div>
          </form>
        )}
      </div>
      <footer className="wizard-footer">
        <button type="button" className="btn" onClick={p.onClose}>
          {t.close}
        </button>
      </footer>
    </div>
  );
}
