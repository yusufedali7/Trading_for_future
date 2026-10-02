import { useEffect, useState, type FormEvent } from 'react';
import {
  runRecord,
  splitRange,
  timeframeMs,
  type AmbiguityRule,
  type DataSetMeta,
  type IanaTz,
  type SplitRole,
  type StoredBacktest,
  type Strategy,
  type StrategyVersion,
} from '@trw/engine';
import { startOfLocalDay } from '../../chart/goto';
import type { CandleSource } from '../../compute/candle-source';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { ResearchRepo } from '../../storage/strategy-repo';
import { formatR } from '../trade/TradePanel';
import { BacktestReport } from './BacktestReport';

const t = tr.backtest;
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

function nextDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface BacktestPanelProps {
  strategy: Strategy;
  version: StrategyVersion;
  datasets: readonly DataSetMeta[];
  source: CandleSource;
  repo: ResearchRepo;
  displayTz: IanaTz;
  now: () => number;
  newId: () => string;
}

export function BacktestPanel(p: BacktestPanelProps) {
  const spec = p.version.spec;
  const usable = p.datasets.filter((d) => d.instrument === spec.instrument);
  const [datasetId, setDatasetId] = useState(usable[0]?.id ?? '');
  const meta = usable.find((d) => d.id === datasetId) ?? usable[0] ?? null;
  const day = (ms: number) => formatTime(ms, p.displayTz).slice(0, 10);
  const [from, setFrom] = useState(meta ? day(meta.range.from) : '');
  const [to, setTo] = useState(meta ? day(meta.range.to) : '');
  const [role, setRole] = useState<SplitRole>('FULL');
  const [boundary, setBoundary] = useState('');
  const [spread, setSpread] = useState('0');
  const [slippage, setSlippage] = useState('0');
  const [commission, setCommission] = useState('0');
  const [equity, setEquity] = useState('10000');
  const [lotStep, setLotStep] = useState('0.01');
  const [minLot, setMinLot] = useState('0.01');
  const [ambiguity, setAmbiguity] = useState<AmbiguityRule>('STOP_FIRST');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<StoredBacktest[]>([]);
  const [shownId, setShownId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    void p.repo.listRuns(p.strategy.id).then(setRuns);
  }, [p.repo, p.strategy.id]);

  if (!meta) return <p className="blocker">{t.noData(spec.instrument)}</p>;

  const costs = {
    spreadPips: num(spread),
    slippagePips: num(slippage),
    commissionPerLotPerSide: num(commission),
  };
  const costFree =
    costs.spreadPips === 0 && costs.slippagePips === 0 && costs.commissionPerLotPerSide === 0;
  const fromMs = startOfLocalDay(from, p.displayTz);
  const toMs = to ? startOfLocalDay(nextDay(to), p.displayTz) : null;
  const boundaryMs = boundary ? startOfLocalDay(boundary, p.displayTz) : null;
  const valid =
    fromMs !== null &&
    toMs !== null &&
    fromMs < toMs &&
    Object.values(costs).every((v) => v >= 0) &&
    num(equity) > 0 &&
    num(lotStep) > 0 &&
    num(minLot) > 0 &&
    (role === 'FULL' || boundaryMs !== null);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      // Never past the data: the range is clipped to what the dataset holds.
      const full = {
        from: Math.max(fromMs!, meta.range.from),
        to: Math.min(toMs!, meta.range.to + timeframeMs(meta.baseTimeframe)),
      };
      const range = splitRange(full, role, boundaryMs);
      const config = {
        range,
        costs,
        ambiguity,
        startEquity: num(equity),
        lots: { lotStep: num(lotStep), minLot: num(minLot) },
      };
      const out = await p.source.backtest(meta, spec, config);
      const trial = role === 'IN_SAMPLE' ? (await p.repo.countInSample(p.strategy.id)) + 1 : null;
      const stored: StoredBacktest = {
        run: runRecord({
          id: p.newId(),
          runAt: p.now(),
          strategy: {
            id: p.strategy.id,
            name: p.strategy.name,
            version: p.version.version,
            specHash: p.version.specHash,
          },
          data: {
            datasetId: meta.id,
            contentHash: meta.contentHash,
            sourceName: meta.source.name,
            instrument: meta.instrument,
            timeframe: spec.timeframe,
            from: range.from,
            to: range.to,
          },
          split: { role, boundary: role === 'FULL' ? null : boundaryMs },
          costs,
          ambiguity,
          startEquity: config.startEquity,
          lots: config.lots,
          inSampleTrial: trial,
        }),
        ...out,
      };
      await p.repo.saveRun(stored);
      setRuns(await p.repo.listRuns(p.strategy.id));
      setShownId(stored.run.id);
      setComparing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const shown = runs.find((r) => r.run.id === shownId) ?? null;
  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    step: number | string = 'any',
  ) => (
    <label className="inline-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );

  return (
    <section className="backtest-panel stack" aria-labelledby="backtest-title">
      <h3 id="backtest-title">
        {t.title} · {tr.strategy.version(p.version.version)}
      </h3>
      <form className="stack" onSubmit={(e) => void run(e)}>
        <div className="builder-grid">
          <label className="inline-field">
            <span>{t.dataset}</span>
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
          <label className="inline-field">
            <span>{t.from}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="inline-field">
            <span>{t.to}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="inline-field">
            <span>{t.split}</span>
            <select value={role} onChange={(e) => setRole(e.target.value as SplitRole)}>
              {(['FULL', 'IN_SAMPLE', 'OUT_OF_SAMPLE'] as const).map((r) => (
                <option key={r} value={r}>
                  {t.splits[r]}
                </option>
              ))}
            </select>
          </label>
          {role !== 'FULL' && (
            <label className="inline-field">
              <span>{t.boundary}</span>
              <input type="date" value={boundary} onChange={(e) => setBoundary(e.target.value)} />
            </label>
          )}
        </div>
        <p className="hint">{t.splitHint}</p>
        <div className="builder-grid">
          {field(t.spread, spread, setSpread, 0.1)}
          {field(t.slippage, slippage, setSlippage, 0.1)}
          {field(t.commission, commission, setCommission, 0.5)}
          {field(t.equity, equity, setEquity, 100)}
          {field(t.lotStep, lotStep, setLotStep, 0.01)}
          {field(t.minLot, minLot, setMinLot, 0.01)}
          <label className="inline-field">
            <span>{t.ambiguity}</span>
            <select
              value={ambiguity}
              onChange={(e) => setAmbiguity(e.target.value as AmbiguityRule)}
            >
              <option value="STOP_FIRST">{t.ambiguities.STOP_FIRST}</option>
              <option value="TARGET_FIRST">{t.ambiguities.TARGET_FIRST}</option>
            </select>
          </label>
        </div>
        {costFree && <p className="warn-text">{t.costFree}</p>}
        <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
          {busy ? t.running : t.run}
        </button>
        {error && (
          <p className="blocker" role="alert">
            {t.failed(error)}
          </p>
        )}
      </form>

      <h4>{t.runs}</h4>
      {runs.length === 0 ? (
        <p className="hint">{t.noRuns}</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>{t.columns.runAt}</th>
                  <th>{t.columns.version}</th>
                  <th>{t.columns.split}</th>
                  <th>{t.columns.range}</th>
                  <th>{t.columns.trades}</th>
                  <th>{t.columns.avgR}</th>
                  <th>{t.columns.pf}</th>
                  <th>{t.columns.dd}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const s = r.stats.summary;
                  return (
                    <tr key={r.run.id} className={r.run.id === shownId ? 'selected' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={t.compare}
                          checked={picked.includes(r.run.id)}
                          onChange={(e) =>
                            setPicked((cur) =>
                              e.target.checked
                                ? [...cur, r.run.id].slice(-2)
                                : cur.filter((x) => x !== r.run.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link"
                          onClick={() => {
                            setShownId(r.run.id);
                            setComparing(false);
                          }}
                        >
                          {formatTime(r.run.runAt, p.displayTz)}
                        </button>
                      </td>
                      <td>{tr.strategy.version(r.run.strategy.version)}</td>
                      <td>{t.splits[r.run.split.role].split(' ')[0]}</td>
                      <td>
                        {day(r.run.data.from)} → {day(r.run.data.to - 1)}
                      </td>
                      <td>{s.trades}</td>
                      <td>{s.avgR === null ? '—' : formatR(s.avgR)}</td>
                      <td>
                        {s.profitFactor === null
                          ? '—'
                          : s.profitFactor.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                      </td>
                      <td>{formatR(-s.maxDrawdownR)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            void p.repo.deleteRun(r.run.id).then(async () => {
                              setRuns(await p.repo.listRuns(p.strategy.id));
                              setPicked((cur) => cur.filter((x) => x !== r.run.id));
                            })
                          }
                        >
                          {t.deleteRun}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn"
            disabled={picked.length !== 2}
            onClick={() => setComparing(true)}
          >
            {t.compare}
          </button>
          {picked.length !== 2 && <span className="hint">{t.compareHint}</span>}
        </>
      )}

      {comparing && picked.length === 2 && (
        <Compare
          runs={picked.map((id) => runs.find((r) => r.run.id === id)!).filter(Boolean)}
          displayTz={p.displayTz}
        />
      )}
      {!comparing && shown && <BacktestReport b={shown} displayTz={p.displayTz} />}
    </section>
  );
}

function Compare({ runs, displayTz }: { runs: StoredBacktest[]; displayTz: IanaTz }) {
  const r = tr.backtest.report;
  const rows: [string, (b: StoredBacktest) => string][] = [
    [tr.backtest.columns.version, (b) => tr.strategy.version(b.run.strategy.version)],
    [
      r.range,
      (b) =>
        `${formatTime(b.run.data.from, displayTz).slice(0, 10)} → ${formatTime(b.run.data.to - 1, displayTz).slice(0, 10)}`,
    ],
    [tr.backtest.split, (b) => tr.backtest.splits[b.run.split.role]],
    [
      r.costs,
      (b) =>
        `${b.run.costs.spreadPips} / ${b.run.costs.slippagePips} / ${b.run.costs.commissionPerLotPerSide}`,
    ],
    [r.trades, (b) => String(b.stats.summary.trades)],
    [
      r.winRate,
      (b) =>
        b.stats.summary.winRate === null ? '—' : `%${(b.stats.summary.winRate * 100).toFixed(1)}`,
    ],
    [r.expectancy, (b) => (b.stats.summary.avgR === null ? '—' : formatR(b.stats.summary.avgR))],
    [r.totalR, (b) => formatR(b.stats.summary.totalR)],
    [
      r.profitFactor,
      (b) =>
        b.stats.summary.profitFactor === null ? '—' : b.stats.summary.profitFactor.toFixed(2),
    ],
    [r.maxDdR, (b) => formatR(-b.stats.summary.maxDrawdownR)],
    [r.ambiguous, (b) => String(b.result.ambiguousTrades)],
    [r.netPnl, (b) => `${b.stats.netPnl.toFixed(2)} USD`],
  ];
  return (
    <div className="table-scroll">
      <table className="data-table compare-table" aria-label={tr.backtest.compare}>
        <thead>
          <tr>
            <th />
            {runs.map((b) => (
              <th key={b.run.id}>{formatTime(b.run.runAt, displayTz)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {runs.map((b) => (
                <td key={b.run.id}>{f(b)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {runs.some((b) => b.stats.summary.lowSample) && (
        <p className="warn-text">
          {r.lowSample(Math.min(...runs.map((b) => b.stats.summary.trades)))}
        </p>
      )}
    </div>
  );
}
