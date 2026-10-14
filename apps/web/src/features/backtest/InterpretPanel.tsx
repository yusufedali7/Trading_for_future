import { useState } from 'react';
import { interpretRun, type Finding, type FindingCode, type StoredBacktest } from '@trw/engine';
import { Term } from '../../components/Term';
import { glossaryById } from '../../content/glossary';
import { TERMS } from '../../content/terms';
import { tr } from '../../i18n/tr';
import { formatR } from '../trade/TradePanel';

const t = tr.interpret;

/** Glossary entry that explains each note's idea. */
const TERM_OF: Partial<Record<FindingCode, string>> = {
  LOW_SAMPLE: TERMS.sample,
  NO_OUT_OF_SAMPLE: TERMS.split,
  OOS_DEGRADATION: TERMS.split,
  OOS_HELD: TERMS.split,
  MANY_TRIALS: TERMS.trials,
  AMBIGUOUS_SHARE: TERMS.ambiguous,
  COSTS_HEAVY: TERMS.costs,
  RANDOM_EDGE: TERMS.ci,
  NO_EDGE_VS_RANDOM: TERMS.ci,
  WORSE_THAN_RANDOM: TERMS.ci,
};

function text(f: Finding): string {
  const p = f.params;
  const R = (k: string) => formatR(p[k]!);
  switch (f.code) {
    case 'NO_TRADES':
    case 'NO_OUT_OF_SAMPLE':
      return t[f.code]();
    case 'LOW_SAMPLE':
      return t.LOW_SAMPLE({ trades: p.trades! });
    case 'OOS_DEGRADATION':
    case 'OOS_HELD':
      return t[f.code]({ isAvgR: R('isAvgR'), oosAvgR: R('oosAvgR') });
    case 'MANY_TRIALS':
      return t.MANY_TRIALS({ trials: p.trials! });
    case 'AMBIGUOUS_SHARE':
      return t.AMBIGUOUS_SHARE({ count: p.count!, pct: p.pct! });
    case 'COSTS_HEAVY':
      return t.COSTS_HEAVY({ pct: p.pct! });
    case 'RANDOM_EDGE':
    case 'NO_EDGE_VS_RANDOM':
    case 'WORSE_THAN_RANDOM':
      return t[f.code]({ edgeR: R('edgeR'), low: R('low'), high: R('high') });
  }
}

export interface InterpretPanelProps {
  b: StoredBacktest;
  /** Latest in-sample run of the same rules, used when `b` is out-of-sample. */
  inSample?: StoredBacktest | null;
  /** Runs and stores the random-entry comparison; absent where it can't be offered. */
  onCompareRandom?: () => Promise<void>;
}

/** "Bu sonuç ne diyor?" (D72): reading notes from the run's own measured numbers. */
export function InterpretPanel({ b, inSample, onCompareRandom }: InterpretPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const findings = interpretRun({ b, inSample });
  const canCompare = !b.random && onCompareRandom && b.result.trades.length > 0;
  return (
    <div className="interpret" role="note" aria-label={t.title}>
      <h4>{t.title}</h4>
      <p className="hint">{t.intro}</p>
      <ul className="findings">
        {findings.map((f) => {
          const term = TERM_OF[f.code];
          return (
            <li key={f.code} className={`finding finding-${f.severity.toLowerCase()}`}>
              <span className="finding-severity">{t.severity[f.severity]}</span> {text(f)}
              {term && (
                <>
                  {' · '}
                  <Term id={term}>{glossaryById(term)?.term}</Term>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {b.random && (
        <p className="hint">
          {t.randomNote(
            b.random.trades,
            b.result.trades.length,
            b.random.seed,
            b.random.stopPips,
            b.random.targetR,
          )}{' '}
          <Term id={TERMS.random}>{glossaryById(TERMS.random)?.term}</Term>
        </p>
      )}
      {canCompare && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            onCompareRandom()
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? t.randomRunning : t.randomButton}
        </button>
      )}
      {error && (
        <p className="blocker" role="alert">
          {t.randomFailed(error)}
        </p>
      )}
    </div>
  );
}
