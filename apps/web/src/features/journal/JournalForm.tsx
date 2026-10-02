import { useState, type FormEvent } from 'react';
import {
  BUILTIN_SESSIONS,
  type Decision,
  type Emotion,
  type IanaTz,
  type JournalResult,
  type Timeframe,
  type TradeStatus,
  type UtcMs,
} from '@trw/engine';
import { formatDuration } from '../../chart/drawing-labels';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import { formatR } from '../trade/TradePanel';

const EMOTIONS: Emotion[] = ['CALM', 'CONFIDENT', 'FOMO', 'FEAR', 'REVENGE', 'BORED', 'OTHER'];
const INTENSITIES = [1, 2, 3, 4, 5] as const;
export const SESSION_NAMES: Record<string, string> = Object.fromEntries(
  BUILTIN_SESSIONS.map((s) => [s.id, s.name]),
);

/** Facts known when the form opens; the user adds the rest. */
export interface JournalDraft {
  instrument: string;
  decision: Decision;
  decidedAt: UtcMs;
  timeframe: Timeframe;
  sessions: string[];
  tradeId: string | null;
  /** Final trade status (no result for expired/cancelled orders). */
  status: TradeStatus | null;
  result: JournalResult | null;
}

export interface JournalFields {
  strategy: string;
  reason: string;
  emotion: Emotion;
  emotionIntensity: 1 | 2 | 3 | 4 | 5;
  lesson: string;
  tags: string[];
  withScreenshot: boolean;
}

export interface JournalFormProps {
  draft: JournalDraft;
  displayTz: IanaTz;
  onSave: (fields: JournalFields) => Promise<void>;
  onSkip: () => void;
}

export function JournalForm({ draft, displayTz, onSave, onSkip }: JournalFormProps) {
  const [strategy, setStrategy] = useState('');
  const [reason, setReason] = useState('');
  const [emotion, setEmotion] = useState<Emotion>('CALM');
  const [intensity, setIntensity] = useState<JournalFields['emotionIntensity']>(3);
  const [lesson, setLesson] = useState('');
  const [tags, setTags] = useState('');
  const [withScreenshot, setWithScreenshot] = useState(true);
  const [saving, setSaving] = useState(false);
  const r = draft.result;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      strategy: strategy.trim(),
      reason: reason.trim(),
      emotion,
      emotionIntensity: intensity,
      lesson: lesson.trim(),
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      withScreenshot,
    });
  };

  return (
    <form
      className="wizard journal-form"
      role="dialog"
      aria-labelledby="journal-form-title"
      onSubmit={(e) => void submit(e)}
    >
      <header className="wizard-header">
        <h2 id="journal-form-title">{tr.journal.formTitle}</h2>
      </header>
      <div className="wizard-body">
        <dl className="kv">
          <div className="kv-row">
            <dt>{tr.journal.decision}</dt>
            <dd>
              {draft.instrument} · {tr.journal.decisions[draft.decision]}
            </dd>
          </div>
          <div className="kv-row">
            <dt>{tr.journal.decidedAt}</dt>
            <dd>
              {formatTime(draft.decidedAt, displayTz)} · {draft.timeframe}
            </dd>
          </div>
          <div className="kv-row">
            <dt>{tr.journal.sessions}</dt>
            <dd>
              {draft.sessions.length
                ? draft.sessions.map((s) => SESSION_NAMES[s] ?? s).join(', ')
                : tr.journal.noSession}
            </dd>
          </div>
          {draft.decision !== 'NO_TRADE' && (
            <div className="kv-row">
              <dt>{tr.journal.result}</dt>
              <dd data-testid="journal-result">
                {r
                  ? `${formatR(r.r)} · ${tr.trade.exitReasons[r.exitReason]}`
                  : tr.journal.noResult(draft.status ? tr.trade.statuses[draft.status] : '')}
              </dd>
            </div>
          )}
          {r && (
            <>
              <div className="kv-row">
                <dt>{tr.journal.duration}</dt>
                <dd>{formatDuration(r.durationMs)}</dd>
              </div>
              <div className="kv-row">
                <dt>{tr.journal.excursions}</dt>
                <dd>
                  {formatR(-r.maeR)} · {formatR(r.mfeR)}
                </dd>
              </div>
            </>
          )}
          {r?.ambiguous && (
            <div className="kv-row warn">
              <dt>{tr.journal.ambiguous}</dt>
              <dd />
            </div>
          )}
        </dl>

        <label className="stack">
          <span>{tr.journal.strategy}</span>
          <input type="text" value={strategy} onChange={(e) => setStrategy(e.target.value)} />
          <span className="hint">{tr.journal.strategyHint}</span>
        </label>
        <label className="stack">
          <span>{tr.journal.reason}</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="form-grid">
          <label htmlFor="journal-emotion">{tr.journal.emotion}</label>
          <select
            id="journal-emotion"
            value={emotion}
            onChange={(e) => setEmotion(e.target.value as Emotion)}
          >
            {EMOTIONS.map((em) => (
              <option key={em} value={em}>
                {tr.journal.emotions[em]}
              </option>
            ))}
          </select>
          <span>{tr.journal.intensity}</span>
          <div className="segmented" role="group" aria-label={tr.journal.intensity}>
            {INTENSITIES.map((n) => (
              <button
                key={n}
                type="button"
                className="seg"
                aria-pressed={intensity === n}
                onClick={() => setIntensity(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="stack">
          <span>{tr.journal.lesson}</span>
          <textarea rows={2} value={lesson} onChange={(e) => setLesson(e.target.value)} />
        </label>
        <label className="stack">
          <span>{tr.journal.tags}</span>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={withScreenshot}
            onChange={(e) => setWithScreenshot(e.target.checked)}
          />
          <span>{tr.journal.screenshot}</span>
        </label>
      </div>
      <footer className="wizard-footer">
        <button type="button" className="btn" onClick={onSkip} disabled={saving}>
          {tr.journal.skip}
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? tr.journal.saving : tr.journal.save}
        </button>
      </footer>
    </form>
  );
}
