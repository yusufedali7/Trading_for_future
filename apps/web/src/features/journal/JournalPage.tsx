import { useEffect, useMemo, useState } from 'react';
import {
  BUILTIN_SESSIONS,
  filterJournal,
  outcomeOf,
  summarizeJournal,
  type Decision,
  type Emotion,
  type IanaTz,
  type JournalEntry,
  type JournalFilter,
  type Outcome,
} from '@trw/engine';
import { startOfLocalDay } from '../../chart/goto';
import { formatDuration } from '../../chart/drawing-labels';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { JournalRepo } from '../../storage/journal-repo';
import { formatR } from '../trade/TradePanel';
import { SESSION_NAMES } from './JournalForm';

const DECISIONS: Decision[] = ['LONG', 'SHORT', 'NO_TRADE'];
const OUTCOMES: Outcome[] = ['WIN', 'LOSS', 'BE', 'NONE'];
const EMOTIONS = Object.keys(tr.journal.emotions) as Emotion[];
const t = tr.journalPage;

interface FilterForm {
  instrument: string;
  decision: string;
  session: string;
  outcome: string;
  emotion: string;
  from: string;
  to: string;
}
const NO_FILTER: FilterForm = {
  instrument: '',
  decision: '',
  session: '',
  outcome: '',
  emotion: '',
  from: '',
  to: '',
};

/** "2026-01-31" → "2026-02-01" */
function nextDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toFilter(f: FilterForm, tz: IanaTz): JournalFilter {
  const from = f.from ? startOfLocalDay(f.from, tz) : null;
  const to = f.to ? startOfLocalDay(nextDay(f.to), tz) : null;
  return {
    ...(f.instrument && { instrument: f.instrument }),
    ...(f.decision && { decision: f.decision as Decision }),
    ...(f.session && { session: f.session }),
    ...(f.outcome && { outcome: f.outcome as Outcome }),
    ...(f.emotion && { emotion: f.emotion as Emotion }),
    ...(from !== null && { from }),
    ...(to !== null && { to }),
  };
}

const pct = (x: number) =>
  `%${(x * 100).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
const dec = (x: number) => x.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

export interface JournalPageProps {
  repo: JournalRepo;
  displayTz: IanaTz;
}

export function JournalPage({ repo, displayTz }: JournalPageProps) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [form, setForm] = useState<FilterForm>(NO_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void repo.listEntries().then(setEntries);
  }, [repo]);

  const all = entries ?? [];
  const shown = useMemo(
    () => filterJournal(all, toFilter(form, displayTz)),
    [entries, form, displayTz],
  );
  const summary = useMemo(() => summarizeJournal(shown), [shown]);
  const instruments = [...new Set(all.map((e) => e.instrument))].sort();
  const selected = shown.find((e) => e.id === selectedId) ?? null;

  const set = (patch: Partial<FilterForm>) => setForm((f) => ({ ...f, ...patch }));
  const select = (label: string, key: keyof FilterForm, options: [string, string][]) => (
    <label className="field">
      <span>{label}</span>
      <select value={form[key]} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">{t.all}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  if (entries === null) return <p className="muted">{tr.app.loading}</p>;

  return (
    <div className="journal-page">
      <h2>{t.title}</h2>
      {all.length === 0 ? (
        <p className="hint">{t.empty}</p>
      ) : (
        <>
          <form
            className="journal-filters"
            aria-label={t.filters}
            onSubmit={(e) => e.preventDefault()}
          >
            {select(
              t.instrument,
              'instrument',
              instruments.map((i) => [i, i]),
            )}
            {select(
              t.decision,
              'decision',
              DECISIONS.map((d) => [d, tr.journal.decisions[d]]),
            )}
            {select(
              t.session,
              'session',
              BUILTIN_SESSIONS.map((s) => [s.id, s.name]),
            )}
            {select(
              t.outcome,
              'outcome',
              OUTCOMES.map((o) => [o, t.outcomes[o]]),
            )}
            {select(
              t.emotion,
              'emotion',
              EMOTIONS.map((em) => [em, tr.journal.emotions[em]]),
            )}
            <label className="field">
              <span>{t.from}</span>
              <input
                type="date"
                value={form.from}
                onChange={(e) => set({ from: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t.to}</span>
              <input type="date" value={form.to} onChange={(e) => set({ to: e.target.value })} />
            </label>
            <button type="button" className="btn" onClick={() => setForm(NO_FILTER)}>
              {t.clear}
            </button>
            <span className="hint" aria-live="polite">
              {t.count(shown.length, all.length)}
            </span>
          </form>

          <Summary summary={summary} />

          <div className="journal-body">
            <div className="table-scroll">
              <table className="journal-table">
                <thead>
                  <tr>
                    <th>{t.columns.time}</th>
                    <th>{t.columns.instrument}</th>
                    <th>{t.columns.decision}</th>
                    <th>{t.columns.session}</th>
                    <th>{t.columns.result}</th>
                    <th>{t.columns.emotion}</th>
                    <th>{t.columns.tags}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <tr
                      key={e.id}
                      className={e.id === selectedId ? 'selected' : undefined}
                      onClick={() => setSelectedId(e.id)}
                    >
                      <td>
                        <button type="button" className="link" onClick={() => setSelectedId(e.id)}>
                          {formatTime(e.decidedAt, displayTz)}
                        </button>
                      </td>
                      <td>{e.instrument}</td>
                      <td>{tr.journal.decisions[e.decision]}</td>
                      <td>{e.sessions.map((s) => SESSION_NAMES[s] ?? s).join(', ') || '—'}</td>
                      <td className={outcomeClass(e)}>
                        {e.result ? formatR(e.result.r) : t.outcomes[outcomeOf(e)]}
                      </td>
                      <td>
                        {tr.journal.emotions[e.emotion]} · {e.emotionIntensity}
                      </td>
                      <td>{e.tags.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected && (
              <EntryDetail
                key={selected.id}
                entry={selected}
                repo={repo}
                displayTz={displayTz}
                onClose={() => setSelectedId(null)}
                onDeleted={(id) => {
                  setSelectedId(null);
                  setEntries((list) => list && list.filter((x) => x.id !== id));
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

const outcomeClass = (e: JournalEntry) => {
  const o = outcomeOf(e);
  return o === 'WIN' ? 'up' : o === 'LOSS' ? 'down' : '';
};

function Summary({ summary }: { summary: ReturnType<typeof summarizeJournal> }) {
  const s = summary.stats;
  const none = t.stats.none;
  const row = (label: string, value: string) => (
    <div className="kv-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <section className="journal-summary" aria-labelledby="journal-summary-title">
      <h3 id="journal-summary-title">{t.summaryTitle}</h3>
      <p className="hint">{t.summaryScope}</p>
      {s.lowSample && (
        <p className="warn-text" role="note">
          {t.lowSample(s.trades)}
        </p>
      )}
      <dl className="kv">
        {row(
          t.stats.entries,
          `${summary.entries} (${t.stats.decisions(
            summary.decisions.LONG,
            summary.decisions.SHORT,
            summary.decisions.NO_TRADE,
          )})`,
        )}
        {row(t.stats.trades, String(s.trades))}
        {row(t.stats.winLoss, `${s.wins} / ${s.losses} / ${s.breakeven}`)}
        {row(t.stats.winRate, s.winRate === null ? none : pct(s.winRate))}
        {row(t.stats.avgR, s.avgR === null ? none : formatR(s.avgR))}
        {row(t.stats.totalR, formatR(s.totalR))}
        {row(t.stats.profitFactor, s.profitFactor === null ? none : dec(s.profitFactor))}
        {row(t.stats.streaks, `${s.longestWinStreak} / ${s.longestLossStreak}`)}
        {row(
          t.stats.largest,
          `${s.largestWinR === null ? none : formatR(s.largestWinR)} / ${
            s.largestLossR === null ? none : formatR(s.largestLossR)
          }`,
        )}
        {row(t.stats.maxDrawdown, formatR(-s.maxDrawdownR))}
      </dl>
      {s.ambiguous > 0 && <p className="warn-text">{t.ambiguousNote(s.ambiguous)}</p>}
    </section>
  );
}

function EntryDetail({
  entry: e,
  repo,
  displayTz,
  onClose,
  onDeleted,
}: {
  entry: JournalEntry;
  repo: JournalRepo;
  displayTz: IanaTz;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const id = e.screenshotIds[0];
    if (!id || typeof URL.createObjectURL !== 'function') return;
    let url: string | null = null;
    let cancelled = false;
    void repo.getScreenshot(id).then((s) => {
      if (!s || cancelled) return;
      url = URL.createObjectURL(new Blob([s.data], { type: s.mime }));
      setImageUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [e.id]);

  const r = e.result;
  const row = (label: string, value: string) =>
    value ? (
      <div className="kv-row">
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ) : null;

  return (
    <section className="panel journal-detail" aria-labelledby="journal-detail-title">
      <h3 id="journal-detail-title">{t.detailTitle}</h3>
      <dl className="kv">
        {row(
          tr.journal.decision,
          `${e.instrument} · ${tr.journal.decisions[e.decision]} · ${e.timeframe}`,
        )}
        {row(tr.journal.decidedAt, formatTime(e.decidedAt, displayTz))}
        {row(
          tr.journal.sessions,
          e.sessions.map((s) => SESSION_NAMES[s] ?? s).join(', ') || tr.journal.noSession,
        )}
        {r && row(tr.journal.result, `${formatR(r.r)} · ${tr.trade.exitReasons[r.exitReason]}`)}
        {r && row(tr.journal.duration, formatDuration(r.durationMs))}
        {r && row(tr.journal.excursions, `${formatR(-r.maeR)} · ${formatR(r.mfeR)}`)}
        {r?.ambiguous && row(tr.journal.ambiguous, '✓')}
        {row(tr.journal.strategy, e.strategy)}
        {row(tr.journal.reason, e.reason)}
        {row(tr.journal.emotion, `${tr.journal.emotions[e.emotion]} · ${e.emotionIntensity}/5`)}
        {row(tr.journal.lesson, e.lesson)}
        {row(t.columns.tags, e.tags.join(', '))}
      </dl>
      {imageUrl ? (
        <img className="journal-shot" src={imageUrl} alt={t.screenshotAlt} />
      ) : (
        e.screenshotIds.length === 0 && <p className="hint">{t.noScreenshot}</p>
      )}
      {confirming ? (
        <div className="stack" role="group" aria-label={t.confirmDelete}>
          <p className="warn-text">{t.confirmDelete}</p>
          <div className="field-row">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void repo.deleteEntry(e.id).then(() => onDeleted(e.id))}
            >
              {t.confirmYes}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              {t.confirmNo}
            </button>
          </div>
        </div>
      ) : (
        <div className="field-row">
          <button type="button" className="btn" onClick={onClose}>
            {t.closeDetail}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            {t.deleteEntry}
          </button>
        </div>
      )}
    </section>
  );
}
