import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  conclude,
  newVersion,
  oosState,
  recordOos,
  reopen,
  sweepGrid,
  sweepableParams,
  timeframeMs,
  validateHypothesis,
  type AmbiguityRule,
  type DataSetMeta,
  type Hypothesis,
  type HypothesisStatus,
  type IanaTz,
  type StoredBacktest,
  type Strategy,
  type StrategySpec,
  type StrategyVersion,
  type SweepAxis,
} from '@trw/engine';
import { startOfLocalDay } from '../../chart/goto';
import { THEME, withAlpha } from '../../chart/theme';
import type { CandleSource } from '../../compute/candle-source';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { ResearchRepo, StrategyRepo } from '../../storage/strategy-repo';
import { BacktestReport } from '../backtest/BacktestReport';
import { runAndStore } from '../backtest/run-and-store';
import { formatR } from '../trade/TradePanel';

const t = tr.research;
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

function nextDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Turkish label of a sweep parameter. */
export function paramLabel(id: string, spec: StrategySpec): string {
  const m = /^steps\.(\d+)\.maxBars$/.exec(id);
  if (m) return t.stepMaxBars(spec.steps[Number(m[1])]?.id ?? id);
  return t.paramLabels[id] ?? id;
}

export interface ResearchPageProps {
  research: ResearchRepo;
  strategies: StrategyRepo;
  source: CandleSource;
  datasets: readonly DataSetMeta[];
  displayTz: IanaTz;
  now: () => number;
  newId: () => string;
}

export function ResearchPage(p: ResearchPageProps) {
  const [list, setList] = useState<Hypothesis[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const reload = useCallback(async () => setList(await p.research.listHypotheses()), [p.research]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const selected = list?.find((h) => h.id === selectedId) ?? null;

  if (list === null) return <p className="muted">{tr.app.loading}</p>;
  return (
    <div className="strategy-page">
      <aside className="strategy-list" aria-label={t.title}>
        <h2>{t.title}</h2>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          {t.newHypothesis}
        </button>
        {list.length === 0 && <p className="hint">{t.empty}</p>}
        <ul className="levels">
          {list.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="level-row"
                aria-pressed={h.id === selectedId}
                onClick={() => {
                  setSelectedId(h.id);
                  setCreating(false);
                }}
              >
                <span>{h.title}</span>
                <span className="muted-inline">{t.statuses[h.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="strategy-detail">
        {creating && (
          <HypothesisForm
            {...p}
            onCreated={async (h) => {
              await reload();
              setSelectedId(h.id);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
        {!creating && selected && (
          <HypothesisDetail
            key={selected.id}
            {...p}
            hypothesis={selected}
            onChange={async (h) => {
              await p.research.saveHypothesis(h);
              await reload();
            }}
          />
        )}
      </section>
    </div>
  );
}

function HypothesisForm(
  p: ResearchPageProps & { onCreated: (h: Hypothesis) => void; onCancel: () => void },
) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [strategyId, setStrategyId] = useState('');
  const [versionNo, setVersionNo] = useState(0);
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [from, setFrom] = useState('');
  const [boundary, setBoundary] = useState('');
  const [to, setTo] = useState('');
  const [spread, setSpread] = useState('0');
  const [slippage, setSlippage] = useState('0');
  const [commission, setCommission] = useState('0');
  const [equity, setEquity] = useState('10000');
  const [ambiguity, setAmbiguity] = useState<AmbiguityRule>('STOP_FIRST');

  useEffect(() => {
    void p.strategies.listStrategies().then((s) => {
      setStrategies(s);
      if (s[0]) setStrategyId(s[0].id);
    });
  }, [p.strategies]);
  useEffect(() => {
    if (!strategyId) return;
    void p.strategies.listVersions(strategyId).then((vs) => {
      setVersions(vs);
      setVersionNo(vs.at(-1)?.version ?? 0);
    });
  }, [p.strategies, strategyId]);
  const version = versions.find((v) => v.version === versionNo) ?? null;
  const usable = p.datasets.filter((d) => d.instrument === version?.spec.instrument);
  const meta = usable.find((d) => d.id === datasetId) ?? usable[0] ?? null;
  const day = (ms: number) => formatTime(ms, p.displayTz).slice(0, 10);
  useEffect(() => {
    if (!meta) return;
    setFrom((f) => f || day(meta.range.from));
    setTo((x) => x || day(meta.range.to));
  }, [meta?.id]);

  if (strategies.length === 0) return <p className="hint">{t.noStrategies}</p>;

  const fromMs = from ? startOfLocalDay(from, p.displayTz) : null;
  const toMs = to ? startOfLocalDay(nextDay(to), p.displayTz) : null;
  const boundaryMs = boundary ? startOfLocalDay(boundary, p.displayTz) : null;
  const draft: Hypothesis | null =
    version && meta
      ? {
          id: '',
          title,
          statement,
          strategyId,
          strategyVersion: version.version,
          setup: {
            datasetId: meta.id,
            contentHash: meta.contentHash,
            from: Math.max(fromMs ?? NaN, meta.range.from),
            boundary: boundaryMs ?? NaN,
            to: Math.min(toMs ?? NaN, meta.range.to + timeframeMs(meta.baseTimeframe)),
            costs: {
              spreadPips: num(spread),
              slippagePips: num(slippage),
              commissionPerLotPerSide: num(commission),
            },
            ambiguity,
            startEquity: num(equity),
            lots: { lotStep: 0.01, minLot: 0.01 },
          },
          status: 'OPEN',
          conclusion: '',
          evidenceRunIds: [],
          oosRunIds: [],
          createdAt: 0,
          updatedAt: 0,
        }
      : null;
  const problems = draft ? validateHypothesis(draft) : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || problems.length > 0) return;
    const at = p.now();
    const h = { ...draft, id: p.newId(), createdAt: at, updatedAt: at };
    await p.research.saveHypothesis(h);
    p.onCreated(h);
  };

  const field = (label: string, value: string, set: (v: string) => void, type = 'number') => (
    <label className="inline-field">
      <span>{label}</span>
      <input type={type} step="any" min={0} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <form className="stack" aria-label={t.newHypothesis} onSubmit={(e) => void submit(e)}>
      <h2>{t.newHypothesis}</h2>
      <label className="stack">
        <span>{t.titleField}</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="stack">
        <span>{t.statement}</span>
        <textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
        <span className="hint">{t.statementHint}</span>
      </label>
      <div className="builder-grid">
        <label className="inline-field">
          <span>{t.strategy}</span>
          <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>{t.version}</span>
          <select value={versionNo} onChange={(e) => setVersionNo(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                {tr.strategy.version(v.version)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="stack">
        <legend>{t.setup}</legend>
        <p className="hint">{t.setupHint}</p>
        {!meta ? (
          <p className="blocker">{tr.backtest.noData(version?.spec.instrument ?? '')}</p>
        ) : (
          <div className="builder-grid">
            <label className="inline-field">
              <span>{tr.backtest.dataset}</span>
              <select value={meta.id} onChange={(e) => setDatasetId(e.target.value)}>
                {usable.map((d) => (
                  <option key={d.id} value={d.id}>
                    {tr.toolbar.datasetOption(
                      d.instrument,
                      d.source.name,
                      day(d.range.from),
                      day(d.range.to),
                    )}
                  </option>
                ))}
              </select>
            </label>
            {field(tr.backtest.from, from, setFrom, 'date')}
            {field(t.boundary, boundary, setBoundary, 'date')}
            {field(tr.backtest.to, to, setTo, 'date')}
            {field(tr.backtest.spread, spread, setSpread)}
            {field(tr.backtest.slippage, slippage, setSlippage)}
            {field(tr.backtest.commission, commission, setCommission)}
            {field(tr.backtest.equity, equity, setEquity)}
            <label className="inline-field">
              <span>{tr.backtest.ambiguity}</span>
              <select
                value={ambiguity}
                onChange={(e) => setAmbiguity(e.target.value as AmbiguityRule)}
              >
                <option value="STOP_FIRST">{tr.backtest.ambiguities.STOP_FIRST}</option>
                <option value="TARGET_FIRST">{tr.backtest.ambiguities.TARGET_FIRST}</option>
              </select>
            </label>
          </div>
        )}
        {draft &&
          draft.setup.costs.spreadPips === 0 &&
          draft.setup.costs.slippagePips === 0 &&
          draft.setup.costs.commissionPerLotPerSide === 0 && (
            <p className="warn-text">{tr.backtest.costFree}</p>
          )}
      </fieldset>
      {problems.length > 0 && (
        <ul className="warn-box" role="alert">
          {problems.map((pr) => (
            <li key={pr}>{t.problems[pr]}</li>
          ))}
        </ul>
      )}
      <div className="field-row">
        <button type="submit" className="btn btn-primary" disabled={!draft || problems.length > 0}>
          {t.create}
        </button>
        <button type="button" className="btn" onClick={p.onCancel}>
          {tr.strategy.cancel}
        </button>
      </div>
    </form>
  );
}

type Grid = {
  axes: string[];
  rows: number[];
  cols: number[];
  cells: Map<string, StoredBacktest>;
};

/** Latest in-sample sweep: runs with the same swept parameters, latest run per combination. */
function latestGrid(runs: readonly StoredBacktest[]): Grid | null {
  const sweeps = runs.filter((b) => b.run.split.role === 'IN_SAMPLE' && b.run.research?.variant);
  const newest = sweeps[0];
  if (!newest) return null;
  const axes = Object.keys(newest.run.research!.variant!);
  const key = (v: Record<string, number>) => axes.map((a) => v[a]).join('|');
  const cells = new Map<string, StoredBacktest>();
  for (const b of sweeps) {
    const v = b.run.research!.variant!;
    if (Object.keys(v).join() !== axes.join()) continue;
    if (!cells.has(key(v))) cells.set(key(v), b);
  }
  const values = (a: string) =>
    [...new Set([...cells.values()].map((b) => b.run.research!.variant![a]!))].sort(
      (x, y) => x - y,
    );
  return { axes, rows: values(axes[0]!), cols: axes[1] ? values(axes[1]) : [NaN], cells };
}

function HypothesisDetail(
  p: ResearchPageProps & { hypothesis: Hypothesis; onChange: (h: Hypothesis) => Promise<void> },
) {
  const h = p.hypothesis;
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [version, setVersion] = useState<StrategyVersion | null>(null);
  const [runs, setRuns] = useState<StoredBacktest[]>([]);
  const [shownId, setShownId] = useState<string | null>(null);
  const [axis1, setAxis1] = useState('');
  const [values1, setValues1] = useState('');
  const [axis2, setAxis2] = useState('');
  const [values2, setValues2] = useState('');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOos, setConfirmOos] = useState(false);
  const [status, setStatus] = useState<Exclude<HypothesisStatus, 'OPEN'>>('INCONCLUSIVE');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);

  const reloadRuns = useCallback(
    async () => setRuns(await p.research.listHypothesisRuns(h.id)),
    [p.research, h.id],
  );
  useEffect(() => {
    void (async () => {
      const s = (await p.strategies.listStrategies()).find((x) => x.id === h.strategyId) ?? null;
      setStrategy(s);
      const v =
        (await p.strategies.listVersions(h.strategyId)).find(
          (x) => x.version === h.strategyVersion,
        ) ?? null;
      setVersion(v);
      if (v) setAxis1(sweepableParams(v.spec)[0]?.id ?? '');
      await reloadRuns();
    })();
  }, [p.strategies, h.strategyId, h.strategyVersion, reloadRuns]);
  useEffect(() => setEvidence(h.oosRunIds), [h.oosRunIds.join()]);

  const meta = p.datasets.find((d) => d.id === h.setup.datasetId) ?? null;
  const params = useMemo(() => (version ? sweepableParams(version.spec) : []), [version]);
  // "1,5; 2; 3" or "1.5 2 3": separated by semicolons or spaces, decimal comma allowed.
  const parse = (s: string) =>
    s
      .split(/[;\s]+/)
      .map((x) => num(x))
      .filter((x) => Number.isFinite(x));
  const axes: SweepAxis[] = [
    ...(axis1 ? [{ id: axis1, values: parse(values1) }] : []),
    ...(axis2 && axis2 !== axis1 ? [{ id: axis2, values: parse(values2) }] : []),
  ];
  let variants: ReturnType<typeof sweepGrid> = [];
  let sweepError: string | null = null;
  try {
    variants = version && axes.length > 0 ? sweepGrid(version.spec, axes) : [];
  } catch {
    sweepError = t.sweepTooBig;
  }
  const valid = variants.filter((v) => v.problems.length === 0);
  const grid = latestGrid(runs);
  const shown = runs.find((r) => r.run.id === shownId) ?? null;
  const inSampleTrials = runs.filter((r) => r.run.split.role === 'IN_SAMPLE').length;
  const oos = oosState(h);
  const day = (ms: number) => formatTime(ms, p.displayTz).slice(0, 10);

  const run = async (
    spec: StrategySpec,
    specHash: string,
    role: 'IN_SAMPLE' | 'OUT_OF_SAMPLE',
    variant: Record<string, number> | null,
  ) => {
    if (!meta || !strategy || !version) return null;
    return runAndStore({
      source: p.source,
      repo: p.research,
      meta,
      strategy,
      version,
      spec,
      specHash,
      range: { from: h.setup.from, to: h.setup.to },
      role,
      boundary: h.setup.boundary,
      costs: h.setup.costs,
      ambiguity: h.setup.ambiguity,
      startEquity: h.setup.startEquity,
      lots: h.setup.lots,
      research: {
        hypothesisId: h.id,
        variant,
        ...(specHash !== version.specHash ? { spec } : {}),
      },
      now: p.now,
      newId: p.newId,
    });
  };

  const runSweep = async () => {
    setMessage(null);
    for (let i = 0; i < valid.length; i++) {
      setProgress([i, valid.length]);
      const v = valid[i]!;
      await run(v.spec, v.specHash, 'IN_SAMPLE', v.values);
    }
    setProgress(null);
    if (variants.length > valid.length) setMessage(t.invalidCombos(variants.length - valid.length));
    await reloadRuns();
  };

  const specOf = (b: StoredBacktest) => b.run.research?.spec ?? version!.spec;

  if (!version || !strategy) return <p className="muted">{tr.app.loading}</p>;
  if (!meta) return <p className="blocker">{tr.backtest.noData(version.spec.instrument)}</p>;
  const c = h.setup.costs;

  return (
    <div className="stack research-detail">
      <h2>
        {h.title} <span className="badge-soft">{t.statuses[h.status]}</span>
      </h2>
      <p>{h.statement}</p>
      <p className="hint">
        {strategy.name} {tr.strategy.version(version.version)} ·{' '}
        {t.setupLine(
          `${meta.instrument} ${version.spec.timeframe}`,
          day(h.setup.from),
          day(h.setup.boundary),
          day(h.setup.to - 1),
          `${c.spreadPips.toLocaleString('tr-TR')} / ${c.slippagePips.toLocaleString('tr-TR')} pip · ${c.commissionPerLotPerSide.toLocaleString('tr-TR')} USD`,
        )}
      </p>
      <p className="warn-text" role="note">
        {t.trials(inSampleTrials)}
      </p>
      <p className="hint">{t.trialsHint}</p>
      {oos.repeated && <p className="warn-text">{t.oosRepeated}</p>}

      <div className="field-row">
        <button
          type="button"
          className="btn"
          disabled={progress !== null}
          onClick={() =>
            void run(version.spec, version.specHash, 'IN_SAMPLE', null).then(async (b) => {
              await reloadRuns();
              if (b) setShownId(b.run.id);
            })
          }
        >
          {t.runBase}
        </button>
      </div>

      <fieldset className="stack">
        <legend>{t.sweep}</legend>
        <div className="builder-grid">
          <label className="inline-field">
            <span>{t.param}</span>
            <select value={axis1} onChange={(e) => setAxis1(e.target.value)}>
              {params.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {paramLabel(pr.id, version.spec)} (şu an {pr.current})
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>{t.values}</span>
            <input
              type="text"
              value={values1}
              onChange={(e) => setValues1(e.target.value)}
              placeholder="1,5; 2; 3"
            />
          </label>
          <label className="inline-field">
            <span>{t.secondParam}</span>
            <select value={axis2} onChange={(e) => setAxis2(e.target.value)}>
              <option value="">{t.none}</option>
              {params
                .filter((pr) => pr.id !== axis1)
                .map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {paramLabel(pr.id, version.spec)} (şu an {pr.current})
                  </option>
                ))}
            </select>
          </label>
          {axis2 && (
            <label className="inline-field">
              <span>{t.values}</span>
              <input
                type="text"
                value={values2}
                onChange={(e) => setValues2(e.target.value)}
                placeholder="0; 1; 2"
              />
            </label>
          )}
        </div>
        {sweepError && <p className="warn-text">{sweepError}</p>}
        <button
          type="button"
          className="btn btn-primary"
          disabled={valid.length === 0 || progress !== null || sweepError !== null}
          onClick={() => void runSweep()}
        >
          {t.runSweep(valid.length)}
        </button>
        {progress && <p className="hint">{t.progress(progress[0] + 1, progress[1])}</p>}
        {message && <p className="warn-text">{message}</p>}
      </fieldset>

      {grid && (
        <SweepGrid
          grid={grid}
          spec={version.spec}
          selectedId={shownId}
          onSelect={(id) => {
            setShownId(id);
            setConfirmOos(false);
          }}
        />
      )}

      {shown && (
        <section className="panel version-panel" aria-label={t.selected}>
          <h3>
            {t.selected}:{' '}
            {shown.run.research?.variant
              ? Object.entries(shown.run.research.variant)
                  .map(([k, v]) => `${paramLabel(k, version.spec)} = ${v}`)
                  .join(', ')
              : t.base}{' '}
            · {tr.backtest.splits[shown.run.split.role]}
          </h3>
          {shown.run.split.role === 'IN_SAMPLE' && (
            <div className="field-row wrap">
              {shown.run.research?.spec && (
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    const latest = (await p.strategies.listStrategies()).find(
                      (s) => s.id === strategy.id,
                    )!;
                    const label = Object.entries(shown.run.research!.variant!)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ');
                    const at = p.now();
                    const v = newVersion(
                      latest,
                      specOf(shown),
                      `Araştırma (${h.title}): ${label}`,
                      at,
                    );
                    await p.strategies.addVersion(v, at);
                    setMessage(t.savedVersion(v.version));
                  }}
                >
                  {t.saveAsVersion}
                </button>
              )}
              {!confirmOos ? (
                <button type="button" className="btn" onClick={() => setConfirmOos(true)}>
                  {t.openOos}
                </button>
              ) : (
                <div className="warn-box stack" role="alertdialog" aria-label={t.openOos}>
                  <p>{t.oosConfirm}</p>
                  {oos.opened && <p>{t.oosRepeated}</p>}
                  <div className="field-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        const b = await run(
                          specOf(shown),
                          shown.run.strategy.specHash,
                          'OUT_OF_SAMPLE',
                          shown.run.research?.variant ?? null,
                        );
                        if (!b) return;
                        await p.onChange(recordOos(h, b.run.id, p.now()));
                        await reloadRuns();
                        setShownId(b.run.id);
                        setConfirmOos(false);
                        setMessage(t.oosOpened);
                      }}
                    >
                      {t.oosConfirmYes}
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmOos(false)}>
                      {tr.strategy.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <BacktestReport b={shown} displayTz={p.displayTz} />
        </section>
      )}

      <fieldset className="stack">
        <legend>{t.conclusion}</legend>
        {h.status !== 'OPEN' ? (
          <>
            <p>
              <strong>{t.statuses[h.status]}</strong> · {h.conclusion}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => void p.onChange(reopen(h, p.now()))}
            >
              {t.reopen}
            </button>
          </>
        ) : (
          <>
            <label className="inline-field">
              <span>{t.conclusion}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {(['SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t.statuses[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span>{t.conclusionNote}</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="stack" role="group" aria-label={t.evidence}>
              <span className="hint">{t.evidence}</span>
              {runs.map((b) => (
                <label key={b.run.id} className="check">
                  <input
                    type="checkbox"
                    checked={evidence.includes(b.run.id)}
                    onChange={(e) =>
                      setEvidence((cur) =>
                        e.target.checked ? [...cur, b.run.id] : cur.filter((x) => x !== b.run.id),
                      )
                    }
                  />
                  <span>
                    {formatTime(b.run.runAt, p.displayTz)} · {tr.backtest.splits[b.run.split.role]}{' '}
                    ·{' '}
                    {b.run.research?.variant
                      ? Object.entries(b.run.research.variant)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(', ')
                      : t.base}{' '}
                    · {b.stats.summary.trades} işlem ·{' '}
                    {b.stats.summary.avgR === null ? '—' : formatR(b.stats.summary.avgR)}
                  </span>
                </label>
              ))}
            </div>
            {status !== 'INCONCLUSIVE' && evidence.length === 0 && (
              <p className="warn-text">{t.evidenceRequired}</p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={status !== 'INCONCLUSIVE' && evidence.length === 0}
              onClick={() => void p.onChange(conclude(h, status, note.trim(), evidence, p.now()))}
            >
              {t.saveConclusion}
            </button>
          </>
        )}
      </fieldset>
    </div>
  );
}

function SweepGrid({
  grid,
  spec,
  selectedId,
  onSelect,
}: {
  grid: Grid;
  spec: StrategySpec;
  selectedId: string | null;
  onSelect: (runId: string) => void;
}) {
  const key = (r: number, c: number) => (grid.axes.length === 2 ? `${r}|${c}` : `${r}`);
  return (
    <div className="table-scroll">
      <table className="data-table sweep-grid">
        <caption>{t.grid}</caption>
        <thead>
          <tr>
            <th>
              {paramLabel(grid.axes[0]!, spec)}
              {grid.axes[1] ? ` \\ ${paramLabel(grid.axes[1], spec)}` : ''}
            </th>
            {grid.cols.map((c) => (
              <th key={c}>{Number.isNaN(c) ? '' : c.toLocaleString('tr-TR')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <tr key={r}>
              <th scope="row">{r.toLocaleString('tr-TR')}</th>
              {grid.cols.map((c) => {
                const b = grid.cells.get(key(r, c));
                if (!b) return <td key={c}>—</td>;
                const avg = b.stats.summary.avgR;
                const tone = avg === null || avg === 0 ? null : avg > 0 ? THEME.up : THEME.down;
                const alpha = avg === null ? 0 : Math.min(Math.abs(avg), 1) * 0.35;
                return (
                  <td key={c} style={tone ? { background: withAlpha(tone, alpha) } : undefined}>
                    <button
                      type="button"
                      className="link"
                      aria-pressed={b.run.id === selectedId}
                      onClick={() => onSelect(b.run.id)}
                    >
                      {t.cell(avg === null ? '—' : formatR(avg), b.stats.summary.trades)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">{t.gridHint}</p>
    </div>
  );
}
