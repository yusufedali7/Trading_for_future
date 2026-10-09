import { useMemo, useState } from 'react';
import {
  BUILTIN_SESSIONS,
  OUTCOME_DEFAULTS,
  featureOutcomes,
  summarizeOutcomes,
  toBars,
  type CandidateOutcome,
  type DataSetMeta,
  type FeatureSet,
  type IanaTz,
  type Instrument,
  type ResampledCandle,
  type SessionLevels,
  type SmcSet,
  type Timeframe,
  type UtcMs,
} from '@trw/engine';
import type { FeatureLayer } from '../../chart/primitives/feature-layout';
import { CONCEPTS, type Concept, type ConceptId } from '../../content/concepts';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';

const t = tr.concepts;

export interface ShowTarget {
  at: UtcMs;
  layer?: FeatureLayer;
  sessionId?: string;
}

export interface ConceptsPageProps {
  /** The chart's current data (not the replay view): examples come from real, loaded data only. */
  data: {
    candles: ResampledCandle[];
    features: FeatureSet;
    sessions: SessionLevels[];
    smc: SmcSet;
  } | null;
  meta: DataSetMeta | null;
  instrument: Instrument | null;
  timeframe: Timeframe;
  displayTz: IanaTz;
  sessionNames: Record<string, string>;
  canShow: boolean;
  onShow: (target: ShowTarget) => void;
}

interface Example {
  id: string;
  at: UtcMs;
  what: string;
  layer?: FeatureLayer;
  sessionId?: string;
}

const k = t.kinds;

function examplesOf(
  c: Concept,
  data: NonNullable<ConceptsPageProps['data']>,
  names: Record<string, string>,
): Example[] {
  const f = data.features;
  const smc = data.smc;
  const layer = c.layer;
  switch (c.id) {
    case 'DISPLACEMENT':
      return smc.displacements.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.direction]! }));
    case 'ORDER_BLOCK':
      return smc.orderBlocks.map((d) => ({
        id: d.id,
        at: d.formedAt,
        what: k[d.direction]!,
        layer,
      }));
    case 'IFVG':
      return smc.ifvgs.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.direction]!, layer }));
    case 'BREAKER':
      return smc.breakers.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.direction]!, layer }));
    case 'EQUAL_LEVELS':
      return smc.equalLevels.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.side]!, layer }));
    case 'PREMIUM_DISCOUNT':
      return smc.premiumDiscount.map((d) => ({
        id: d.id,
        at: d.formedAt,
        what: t.equilibriumAt(d.equilibrium),
        layer,
      }));
    case 'OTE':
      return smc.ote.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.direction]!, layer }));
    case 'CANDIDATE_SR':
      return smc.candidateSr.map((d) => ({
        id: d.id,
        at: d.formedAt,
        what: t.touches(d.touches),
        layer,
      }));
    case 'SWING':
      return f.swings.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.kind]!, layer }));
    case 'FVG':
      return f.fvgs.map((d) => ({ id: d.id, at: d.formedAt, what: k[d.direction]!, layer }));
    case 'STRUCTURE_BREAK':
      return f.breaks.map((d) => ({
        id: d.id,
        at: d.formedAt,
        what: `${d.kind === 'BOS' ? 'BOS' : 'CHoCH'} ${k[d.direction]!}`,
        layer,
      }));
    case 'LIQUIDITY_SWEEP':
      return f.sweeps.map((d) => ({
        id: d.id,
        at: d.formedAt,
        what: `${k[d.direction]!} · ${d.levelKind}`,
        layer,
      }));
    case 'PERIOD_LEVELS':
      return f.periods.map((d) => ({
        id: d.id,
        at: d.knownAt,
        what: k[d.period]!,
        layer: d.period === 'DAY' ? 'PREV_DAY' : 'PREV_WEEK',
      }));
    case 'SESSIONS':
      return data.sessions
        .filter((s) => s.complete && s.barCount > 0)
        .map((s) => ({
          id: `${s.sessionId}:${s.startUtc}`,
          at: s.startUtc,
          what:
            names[s.sessionId] ??
            BUILTIN_SESSIONS.find((b) => b.id === s.sessionId)?.name ??
            s.sessionId,
          sessionId: s.sessionId,
        }));
  }
}

export function ConceptsPage(p: ConceptsPageProps) {
  const [id, setId] = useState<ConceptId>('SWING');
  const c = CONCEPTS.find((x) => x.id === id)!;

  return (
    <div className="journal-page concepts-page">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>
      <div className="concepts-layout">
        <nav className="concept-list" aria-label={t.listLabel}>
          {CONCEPTS.map((x) => (
            <button
              key={x.id}
              type="button"
              className="concept-item"
              aria-pressed={x.id === id}
              onClick={() => setId(x.id)}
            >
              <strong>{x.name}</strong>
              <span className="hint">{x.short}</span>
            </button>
          ))}
        </nav>
        <ConceptCard key={c.id} concept={c} {...p} />
      </div>
    </div>
  );
}

function ConceptCard({ concept: c, ...p }: ConceptsPageProps & { concept: Concept }) {
  return (
    <article className="panel concept-card stack" aria-label={c.name}>
      <h3>{c.name}</h3>
      <section>
        <h4>{t.what}</h4>
        {c.what.map((x) => (
          <p key={x}>{x}</p>
        ))}
        <p className="hint">
          <strong>{t.onChart}:</strong> {c.onChart}
        </p>
      </section>
      <section>
        <h4>{t.rule}</h4>
        <ul>
          {c.rule.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {c.params.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.param}</th>
                  <th>{t.value}</th>
                  <th>{t.meaning}</th>
                </tr>
              </thead>
              <tbody>
                {c.params.map((x) => (
                  <tr key={x.name}>
                    <td className="mono">{x.name}</td>
                    <td className="mono">{x.value}</td>
                    <td>{x.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p>
          <strong>{t.delay}</strong> {c.delay}
        </p>
        <p className="hint">{t.doc(c.doc)}</p>
      </section>
      <RealData concept={c} {...p} />
      <section>
        <h4>{t.limits}</h4>
        <ul>
          {c.limits.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function RealData({ concept: c, ...p }: ConceptsPageProps & { concept: Concept }) {
  const [horizon, setHorizon] = useState(OUTCOME_DEFAULTS.horizonBars);
  const data = p.data;
  const examples = useMemo(
    () => (data ? examplesOf(c, data, p.sessionNames) : []),
    [c, data, p.sessionNames],
  );
  const outcomes = useMemo(() => {
    if (!data || !p.instrument || !c.outcome) return null;
    const bars = toBars(data.candles, p.instrument, p.timeframe);
    return featureOutcomes(bars, data.features, { horizonBars: horizon }, data.smc)[c.outcome];
  }, [c.outcome, data, p.instrument, p.timeframe, horizon]);

  if (!data || !p.meta) {
    return (
      <section>
        <h4>{t.data}</h4>
        <p className="hint">{t.noData}</p>
      </section>
    );
  }
  const byId = new Map<string, CandidateOutcome>(outcomes?.map((o) => [o.id, o]) ?? []);
  const failures = examples.filter((e) => byId.get(e.id)?.status === 'FAILED');
  const sum = outcomes ? summarizeOutcomes(outcomes) : null;
  const decided = sum ? sum.held + sum.failed : 0;

  return (
    <section aria-label={t.data}>
      <h4>{t.data}</h4>
      <p className="hint">{t.dataSource(p.meta.instrument, p.meta.source.name, p.timeframe)}</p>
      <p>{examples.length > 0 ? t.count(examples.length) : t.none}</p>
      <Browser label={t.examples} list={examples} {...p} />

      {c.failure && c.expectation && sum && (
        <div className="stack">
          <p>
            <strong>{t.expectation}:</strong> {c.expectation}
          </p>
          <p>
            <strong>{t.yardstick}:</strong> {c.failure(horizon)}
          </p>
          <label className="inline-field">
            <span>{t.horizon}</span>
            <input
              type="number"
              min={1}
              max={200}
              value={horizon}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (n >= 1 && n <= 200) setHorizon(n);
              }}
            />
          </label>
          <p role="status">
            {decided === 0
              ? t.noneDecided
              : t.summary(
                  decided,
                  sum.held,
                  sum.failed,
                  ((sum.failureRate ?? 0) * 100).toFixed(1).replace('.', ','),
                  sum.pending,
                )}
          </p>
          {decided > 0 && sum.lowSample && <p className="warn-text">{t.lowSample(decided)}</p>}
          <p className="hint">{t.measuredNote}</p>
          {failures.length > 0 ? (
            <Browser
              label={t.failures}
              list={failures}
              failedAt={(e) => byId.get(e.id)?.failedAt ?? null}
              {...p}
            />
          ) : (
            <p className="hint">{t.noFailures}</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Steps through examples (newest first by default) and jumps to one on the chart. */
function Browser({
  label,
  list,
  failedAt,
  displayTz,
  canShow,
  onShow,
}: ConceptsPageProps & {
  label: string;
  list: Example[];
  failedAt?: (e: Example) => UtcMs | null;
}) {
  const [i, setI] = useState(list.length - 1);
  if (list.length === 0) return null;
  const at = Math.min(Math.max(i, 0), list.length - 1);
  const e = list[at]!;
  const broke = failedAt?.(e) ?? null;
  return (
    <div className="field-row wrap" role="group" aria-label={label}>
      <strong>{label}:</strong>
      <button type="button" className="btn" disabled={at === 0} onClick={() => setI(at - 1)}>
        {t.prev}
      </button>
      <span className="mono">
        {t.example(at + 1, list.length, formatTime(e.at, displayTz), e.what)}
        {broke !== null && ` · ${t.failedAt(formatTime(broke, displayTz))}`}
      </span>
      <button
        type="button"
        className="btn"
        disabled={at === list.length - 1}
        onClick={() => setI(at + 1)}
      >
        {t.next}
      </button>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canShow}
        title={canShow ? undefined : t.showBlocked}
        onClick={() =>
          onShow({
            at: e.at,
            ...(e.layer ? { layer: e.layer } : {}),
            ...(e.sessionId ? { sessionId: e.sessionId } : {}),
          })
        }
      >
        {t.show}
      </button>
    </div>
  );
}
