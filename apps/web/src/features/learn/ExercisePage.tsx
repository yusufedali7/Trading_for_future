import { useMemo, useState } from 'react';
import {
  buildQuiz,
  SWING_DEFAULTS,
  toBars,
  type Bars,
  type DataSetMeta,
  type FeatureSet,
  type IanaTz,
  type Instrument,
  type QuizQuestion,
  type ResampledCandle,
  type Timeframe,
} from '@trw/engine';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { ExerciseRound } from '../../storage/db-user';
import { MiniCandles } from './MiniCandles';

const t = tr.learn.exercise;
const QUESTIONS_PER_ROUND = 10;
/** Bars shown to the left of the question's bar. */
const CONTEXT_BARS = 30;
/** Bars shown past the answer point once it is revealed. */
const AFTER_REVEAL = 2;

export interface ExercisePageProps {
  /** The chart's loaded data: questions only ever come from real, loaded data (rule 1). */
  data: { candles: ResampledCandle[]; features: FeatureSet } | null;
  meta: DataSetMeta | null;
  instrument: Instrument | null;
  timeframe: Timeframe;
  displayTz: IanaTz;
  history: readonly ExerciseRound[];
  now: () => number;
  onFinish: (round: ExerciseRound) => void;
}

interface Round {
  seed: number;
  questions: QuizQuestion[];
  at: number;
  /** Whether each answered question was right. */
  results: boolean[];
  /** The current question has been answered and its answer is shown. */
  revealed: boolean;
}

function markFor(q: QuizQuestion, bars: Bars, features: FeatureSet) {
  if (!q.answer) return undefined;
  if (q.kind === 'SWING')
    return { price: q.side === 'HIGH' ? bars.h[q.subjectIndex]! : bars.l[q.subjectIndex]! };
  const gap = features.fvgs.find(
    (f) => f.confirmedIndex === q.cursorIndex && f.direction === q.side,
  );
  return gap ? { top: gap.top, bottom: gap.bottom, from: q.subjectIndex - 1 } : undefined;
}

/** Practice (D74): seeded recognition questions on the loaded data, answered before the reveal. */
export function ExercisePage(p: ExercisePageProps) {
  const [round, setRound] = useState<Round | null>(null);
  const bars = useMemo(
    () => (p.data && p.instrument ? toBars(p.data.candles, p.instrument, p.timeframe) : null),
    [p.data, p.instrument, p.timeframe],
  );

  if (!p.data || !p.meta || !p.instrument || !bars) {
    return (
      <div className="journal-page exercise-page">
        <h2>{t.title}</h2>
        <p className="hint">{t.intro}</p>
        <p className="muted">{t.noData}</p>
      </div>
    );
  }
  const { data, meta } = p;

  const start = () => {
    const seed = Math.floor(p.now()) % 2_147_483_647;
    const questions = buildQuiz({
      bars,
      features: data.features,
      swing: SWING_DEFAULTS,
      kinds: ['SWING', 'FVG'],
      count: QUESTIONS_PER_ROUND,
      seed,
      minHistory: CONTEXT_BARS,
    });
    setRound({ seed, questions, at: p.now(), results: [], revealed: false });
  };

  // While revealed, the question just answered stays on screen.
  const at = round ? round.results.length - (round.revealed ? 1 : 0) : 0;
  const q = round?.questions[at];
  const lastRight = round?.results[round.results.length - 1] ?? false;
  const done =
    round !== null &&
    !round.revealed &&
    round.questions.length > 0 &&
    round.results.length === round.questions.length;

  const answer = (yes: boolean) => {
    if (!round || !q) return;
    setRound({ ...round, results: [...round.results, yes === q.answer], revealed: true });
  };

  const next = () => {
    if (!round) return;
    const finished = round.results.length === round.questions.length;
    setRound({ ...round, revealed: false });
    if (finished)
      p.onFinish({
        at: round.at,
        seed: round.seed,
        datasetId: meta.id,
        timeframe: p.timeframe,
        total: round.questions.length,
        correct: round.results.filter(Boolean).length,
      });
  };

  return (
    <div className="journal-page exercise-page">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>
      <p className="muted-inline">{t.source(meta.instrument, p.timeframe)}</p>

      {(round === null || done || round.questions.length === 0) && (
        <div className="stack">
          {done && (
            <>
              <p>
                <strong>
                  {t.score(round.questions.length, round.results.filter(Boolean).length)}
                </strong>
              </p>
              <p className="hint">{t.seed(round.seed)}</p>
            </>
          )}
          {round !== null && round.questions.length === 0 ? (
            <p className="muted">{t.tooFew}</p>
          ) : null}
          <div>
            <button type="button" className="btn btn-primary" onClick={start}>
              {t.start(QUESTIONS_PER_ROUND)}
            </button>
          </div>
        </div>
      )}

      {round && q && (
        <section className="panel stack" aria-label={t.progress(at + 1, round.questions.length)}>
          <p className="muted-inline">{t.progress(at + 1, round.questions.length)}</p>
          <MiniCandles
            bars={bars}
            from={Math.max(0, q.subjectIndex - CONTEXT_BARS)}
            to={
              round.revealed
                ? Math.min(bars.length - 1, Math.max(q.revealIndex, q.cursorIndex) + AFTER_REVEAL)
                : q.cursorIndex
            }
            subject={q.subjectIndex}
            cursor={q.cursorIndex}
            mark={round.revealed ? markFor(q, bars, data.features) : undefined}
            label={t.chart(q.cursorIndex - Math.max(0, q.subjectIndex - CONTEXT_BARS) + 1)}
          />
          <p>{t.question[q.side]}</p>
          {!round.revealed ? (
            <div className="field-row">
              <button type="button" className="btn" onClick={() => answer(true)}>
                {t.yes}
              </button>
              <button type="button" className="btn" onClick={() => answer(false)}>
                {t.no}
              </button>
            </div>
          ) : (
            <>
              <p className={lastRight ? '' : 'warn-text'}>
                {q.kind === 'SWING'
                  ? t.revealSwing(lastRight, q.answer, SWING_DEFAULTS.right)
                  : t.revealFvg(lastRight, q.answer)}
              </p>
              <div>
                <button type="button" className="btn btn-primary" onClick={next}>
                  {round.results.length === round.questions.length ? t.finish : t.next}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {p.history.length > 0 && (
        <>
          <h3>{t.history}</h3>
          <ul className="levels">
            {p.history.map((r) => (
              <li key={`${r.at}:${r.seed}`} className="muted-inline">
                {t.historyRow(formatTime(r.at, p.displayTz), r.timeframe, r.correct, r.total)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
