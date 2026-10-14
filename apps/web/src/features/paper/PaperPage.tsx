import { useCallback, useEffect, useState } from 'react';
import {
  getInstrument,
  lotRules,
  listInstruments,
  timeframeMs,
  type DataSetMeta,
  type IanaTz,
  type Strategy,
  type StrategyVersion,
} from '@trw/engine';
import type { BacktestOutcome, CandleSource } from '../../compute/candle-source';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { MarketRepo } from '../../storage/market-repo';
import type { PaperSession, ResearchRepo, StrategyRepo } from '../../storage/strategy-repo';
import { formatR } from '../trade/TradePanel';
import type { Mt5Feed } from './use-mt5-feed';

const t = tr.paper;

export interface PaperPageProps {
  research: ResearchRepo;
  strategies: StrategyRepo;
  source: CandleSource;
  market: MarketRepo;
  /** The MT5 feed lives in the app shell so its auto-update survives view switches. */
  feed: Mt5Feed;
  displayTz: IanaTz;
  now: () => number;
  newId: () => string;
}

const offsetLabel = (ms: number) => {
  const m = Math.round(ms / 60_000);
  const sign = m < 0 ? '−' : '+';
  const a = Math.abs(m);
  return `UTC${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
};

export function PaperPage(p: PaperPageProps) {
  const { config, setConfig, syncing, problem, last, sync } = p.feed;
  const { instrument, brokerSymbol, auto } = config;
  const [sessions, setSessions] = useState<PaperSession[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, BacktestOutcome>>({});
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [versions, setVersions] = useState<Record<string, StrategyVersion[]>>({});
  const [feeds, setFeeds] = useState<DataSetMeta[]>([]);

  const loadAll = useCallback(async () => {
    const list = await p.strategies.listStrategies();
    setStrategies(list);
    const vs: Record<string, StrategyVersion[]> = {};
    for (const s of list) vs[s.id] = await p.strategies.listVersions(s.id);
    setVersions(vs);
    setSessions(await p.research.listPaperSessions());
  }, [p.strategies, p.research]);
  useEffect(() => {
    void loadAll();
  }, [loadAll]);
  // Every sync (also those made while another view was open) brings new feed data.
  useEffect(() => {
    void p.market
      .listDatasets()
      .then((list) => setFeeds(list.filter((d) => d.id.startsWith('mt5:'))));
  }, [p.market, last]);

  const specOf = (s: PaperSession) =>
    versions[s.strategyId]?.find((v) => v.version === s.strategyVersion)?.spec ?? null;

  /** Re-runs every session on the stored feed data, forward from its start. */
  const evaluate = useCallback(
    async (list: PaperSession[]) => {
      const datasets = await p.market.listDatasets();
      const next: Record<string, BacktestOutcome> = {};
      for (const s of list) {
        const meta = datasets.find((d) => d.id === s.datasetId);
        const spec = specOf(s);
        if (!meta || !spec) continue;
        const end = meta.range.to + timeframeMs(meta.baseTimeframe);
        const to = Math.min(end, s.stoppedAt ?? end);
        if (to <= s.startedAt) continue;
        next[s.id] = await p.source.backtest(meta, spec, {
          range: { from: s.startedAt, to },
          costs: s.costs,
          ambiguity: s.ambiguity,
          startEquity: s.startEquity,
          lots: s.lots,
          keepOpenAtEnd: s.stoppedAt === null,
        });
      }
      setOutcomes(next);
    },
    [p.market, p.source, versions],
  );
  useEffect(() => {
    void evaluate(sessions);
  }, [evaluate, sessions, last]);

  return (
    <div className="journal-page paper-page">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>

      <section className="panel version-panel stack" aria-label={t.feed}>
        <h3>{t.feed}</h3>
        <div className="builder-grid">
          <label className="inline-field">
            <span>{t.instrument}</span>
            <select value={instrument} onChange={(e) => setConfig({ instrument: e.target.value })}>
              {listInstruments().map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>{t.brokerSymbol}</span>
            <input
              type="text"
              value={brokerSymbol}
              onChange={(e) => setConfig({ brokerSymbol: e.target.value })}
            />
          </label>
        </div>
        <div className="field-row wrap">
          <button
            type="button"
            className="btn btn-primary"
            disabled={syncing}
            onClick={() => void sync()}
          >
            {syncing ? t.syncing : t.sync}
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setConfig({ auto: e.target.checked })}
            />
            <span>{t.auto}</span>
          </label>
        </div>
        {problem && (
          <p className="blocker" role="alert">
            {t.problems[problem]}
          </p>
        )}
        {last && (
          <>
            <p className="hint" role="status">
              {t.connected(last.meta.source.name.replace(/^MT5: /, ''), offsetLabel(last.offsetMs))}
              {' · '}
              {t.lastSync(last.added, last.revised, formatTime(last.meta.range.to, p.displayTz))}
            </p>
            {last.dstWarning && <p className="warn-text">{t.dstWarning}</p>}
          </>
        )}
      </section>

      <NewSession
        {...p}
        instrument={instrument}
        strategyList={strategies}
        versions={versions}
        feedId={
          last?.meta.instrument === instrument
            ? last.meta.id
            : (feeds.find((d) => d.instrument === instrument)?.id ?? null)
        }
        onStarted={async () => setSessions(await p.research.listPaperSessions())}
      />

      <h3>{t.sessions}</h3>
      <p className="hint">{t.forwardNote}</p>
      {sessions.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          outcome={outcomes[s.id] ?? null}
          displayTz={p.displayTz}
          onStop={async () => {
            await p.research.savePaperSession({ ...s, stoppedAt: p.now() });
            setSessions(await p.research.listPaperSessions());
          }}
        />
      ))}
    </div>
  );
}

function NewSession(
  p: PaperPageProps & {
    instrument: string;
    strategyList: Strategy[];
    versions: Record<string, StrategyVersion[]>;
    feedId: string | null;
    onStarted: () => Promise<void>;
  },
) {
  const candidates = p.strategyList.flatMap((s) =>
    (p.versions[s.id] ?? [])
      .filter((v) => v.spec.instrument === p.instrument)
      .map((v) => ({ s, v, key: `${s.id}#${v.version}` })),
  );
  const [key, setKey] = useState('');
  const [spread, setSpread] = useState('0');
  const [slippage, setSlippage] = useState('0');
  const [commission, setCommission] = useState('0');
  const [equity, setEquity] = useState('10000');
  const chosen = candidates.find((c) => c.key === key) ?? candidates[0] ?? null;
  const num = (v: string) => Number(v.replace(',', '.'));

  if (!p.feedId) return <p className="hint">{t.noFeedData}</p>;
  if (!chosen) return <p className="hint">{t.noStrategy}</p>;
  const costs = {
    spreadPips: num(spread),
    slippagePips: num(slippage),
    commissionPerLotPerSide: num(commission),
  };
  const valid = Object.values(costs).every((x) => x >= 0) && num(equity) > 0;
  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="inline-field">
      <span>{label}</span>
      <input type="number" step="any" min={0} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <form
      className="panel version-panel stack"
      aria-label={t.newSession}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        const at = p.now();
        await p.research.savePaperSession({
          id: p.newId(),
          strategyId: chosen.s.id,
          strategyName: chosen.s.name,
          strategyVersion: chosen.v.version,
          datasetId: p.feedId!,
          startedAt: at,
          stoppedAt: null,
          costs,
          ambiguity: 'STOP_FIRST',
          startEquity: num(equity),
          lots: lotRules(getInstrument(chosen.v.spec.instrument)),
          createdAt: at,
        });
        await p.onStarted();
      }}
    >
      <h3>{t.newSession}</h3>
      <div className="builder-grid">
        <label className="inline-field">
          <span>{tr.research.strategy}</span>
          <select value={chosen.key} onChange={(e) => setKey(e.target.value)}>
            {candidates.map((c) => (
              <option key={c.key} value={c.key}>
                {c.s.name} {tr.strategy.version(c.v.version)}
              </option>
            ))}
          </select>
        </label>
        {field(tr.backtest.spread, spread, setSpread)}
        {field(tr.backtest.slippage, slippage, setSlippage)}
        {field(tr.backtest.commission, commission, setCommission)}
        {field(tr.backtest.equity, equity, setEquity)}
      </div>
      {costs.spreadPips === 0 &&
        costs.slippagePips === 0 &&
        costs.commissionPerLotPerSide === 0 && <p className="warn-text">{tr.backtest.costFree}</p>}
      <button type="submit" className="btn btn-primary" disabled={!valid}>
        {t.start}
      </button>
    </form>
  );
}

function SessionCard({
  session: s,
  outcome,
  displayTz,
  onStop,
}: {
  session: PaperSession;
  outcome: BacktestOutcome | null;
  displayTz: IanaTz;
  onStop: () => void;
}) {
  const r = outcome?.result;
  const st = outcome?.stats.summary;
  const pos = r?.open?.[0] ?? null;
  return (
    <section
      className="panel version-panel stack"
      aria-label={`${s.strategyName} ${tr.strategy.version(s.strategyVersion)}`}
    >
      <h4>
        {s.strategyName} {tr.strategy.version(s.strategyVersion)} ·{' '}
        <span className="badge-soft">{s.stoppedAt === null ? t.running : t.stopped}</span>
      </h4>
      <p className="hint">{t.startedAt(formatTime(s.startedAt, displayTz))}</p>
      {st && st.trades > 0 ? (
        <p>
          {t.summary(st.trades, st.avgR === null ? '—' : formatR(st.avgR), formatR(st.totalR))}
          {st.lowSample && (
            <span className="warn-text"> · {tr.backtest.report.lowSample(st.trades)}</span>
          )}
        </p>
      ) : (
        <p className="hint">{t.noTrades}</p>
      )}
      {pos ? (
        <div className="stack" role="status">
          <strong>{pos.sim.status === 'OPEN' ? t.openPosition : t.pending}</strong>
          <span className="mono">
            {pos.order.direction} · {pos.order.type} · SL {pos.order.stop} · TP {pos.order.target} ·{' '}
            {pos.lots} lot
            {pos.sim.entryPrice !== undefined ? ` · giriş ${pos.sim.entryPrice}` : ''}
          </span>
          {pos.sim.r !== null && (
            <span>
              {t.liveR}:{' '}
              <span className={pos.sim.r >= 0 ? 'up' : 'down'}>{formatR(pos.sim.r)}</span>
            </span>
          )}
        </div>
      ) : (
        s.stoppedAt === null && <p className="hint">{t.none}</p>
      )}
      {r && r.trades.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <caption>{t.closed}</caption>
            <thead>
              <tr>
                <th>{tr.backtest.report.col.signal}</th>
                <th>{tr.backtest.report.col.entry}</th>
                <th>{tr.backtest.report.col.exit}</th>
                <th>{tr.backtest.report.col.reason}</th>
                <th>{tr.backtest.report.col.r}</th>
                <th>{tr.backtest.report.col.pnl}</th>
              </tr>
            </thead>
            <tbody>
              {r.trades.map((x) => (
                <tr key={x.setupId}>
                  <td>{formatTime(x.signalAt, displayTz)}</td>
                  <td>{x.entryPrice}</td>
                  <td>{x.exitPrice}</td>
                  <td>{tr.backtest.report.exits[x.exit]}</td>
                  <td className={x.r > 0 ? 'up' : x.r < 0 ? 'down' : ''}>{formatR(x.r)}</td>
                  <td>{x.pnl.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.stoppedAt === null && (
        <button type="button" className="btn" onClick={onStop}>
          {t.stop}
        </button>
      )}
    </section>
  );
}
