import { SKIP_REASONS, type BreakdownRow, type IanaTz, type StoredBacktest } from '@trw/engine';
import { backtestTradesCsv } from '../../backup/csv';
import { saveFile } from '../../backup/download';
import { formatTime } from '../../format';
import { Term } from '../../components/Term';
import { TERMS } from '../../content/terms';
import { tr } from '../../i18n/tr';
import { formatR } from '../trade/TradePanel';
import { SESSION_NAMES } from '../journal/JournalForm';
import { EquityChart, RHistogram } from './charts';
import { InterpretPanel } from './InterpretPanel';

const t = tr.backtest.report;
const usd = (v: number) =>
  v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `%${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
const date = (ms: number, tz: IanaTz) => formatTime(ms, tz).slice(0, 10);

function Row({
  label,
  value,
  warn,
  term,
}: {
  label: string;
  value: string;
  warn?: boolean;
  term?: string;
}) {
  return (
    <div className={`kv-row${warn ? ' warn' : ''}`}>
      <dt>{term ? <Term id={term}>{label}</Term> : label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  keyLabel,
}: {
  title: string;
  rows: BreakdownRow[];
  keyLabel: (k: string) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>{t.key}</th>
            <th>{t.trades}</th>
            <th>{t.winRate}</th>
            <th>{t.expectancy}</th>
            <th>{t.totalR}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{keyLabel(r.key)}</td>
              <td>{r.trades}</td>
              <td>{r.winRate === null ? t.none : pct(r.winRate * 100)}</td>
              <td>{r.avgR === null ? t.none : formatR(r.avgR)}</td>
              <td>{formatR(r.totalR)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One stored backtest: record, honesty indicators, measured results, charts and breakdowns. */
export function BacktestReport({
  b,
  displayTz,
  inSample,
  onCompareRandom,
}: {
  b: StoredBacktest;
  displayTz: IanaTz;
  /** Latest in-sample run of the same rules (for an out-of-sample run's reading notes). */
  inSample?: StoredBacktest | null;
  onCompareRandom?: () => Promise<void>;
}) {
  const { run, result, stats } = b;
  const s = stats.summary;
  const c = run.costs;
  const skippedTotal = SKIP_REASONS.reduce((n, k) => n + result.skipped[k], 0);
  return (
    <section className="backtest-report" aria-label={tr.backtest.title}>
      <details>
        <summary>{t.record}</summary>
        <dl className="kv">
          <Row
            label={t.strategy}
            value={`${run.strategy.name} v${run.strategy.version} · ${tr.strategy.hash(run.strategy.specHash)}`}
          />
          <Row
            label={t.data}
            value={`${run.data.instrument} ${run.data.timeframe} · ${run.data.sourceName} · ${run.data.contentHash.slice(0, 10)}`}
          />
          <Row
            label={t.range}
            value={`${date(run.data.from, displayTz)} → ${date(run.data.to, displayTz)} · ${tr.backtest.splits[run.split.role]}`}
          />
          <Row
            label={t.costs}
            value={`${c.spreadPips} pip spread · ${c.slippagePips} pip kayma · ${c.commissionPerLotPerSide} USD/lot/taraf · ${tr.backtest.ambiguities[run.ambiguity]}`}
          />
          <Row
            label={t.engine}
            value={`${run.engineVersion} · ${Object.entries(run.definitions)
              .map(([k, v]) => `${k} ${v}`)
              .join(', ')}`}
          />
          <Row label={t.runAt} value={formatTime(run.runAt, displayTz)} />
        </dl>
      </details>

      <div className="honesty" role="note" aria-label={t.honesty}>
        <h4>{t.honesty}</h4>
        {s.trades === 0 && <p className="warn-text">{t.noTrades}</p>}
        {s.trades > 0 && s.lowSample && <p className="warn-text">{t.lowSample(s.trades)}</p>}
        {run.inSampleTrial !== null && <p className="warn-text">{t.trial(run.inSampleTrial)}</p>}
        {run.split.role === 'OUT_OF_SAMPLE' && <p className="hint">{t.oos}</p>}
        <dl className="kv">
          <Row label={t.setups} value={String(result.setupsFound)} />
          <Row
            label={t.skipped}
            term={TERMS.skipped}
            value={
              skippedTotal === 0
                ? '0'
                : `${skippedTotal} (${SKIP_REASONS.filter((k) => result.skipped[k] > 0)
                    .map((k) => `${t.skipReasons[k]}: ${result.skipped[k]}`)
                    .join(', ')})`
            }
            warn={result.skipped.DATA_GAP > 0}
          />
          <Row
            label={t.ambiguous}
            term={TERMS.ambiguous}
            value={String(result.ambiguousTrades)}
            warn={result.ambiguousTrades > 0}
          />
          <Row label={t.expired} value={String(result.expiredOrders)} />
          <Row label={t.unfilled} value={String(result.unfilledAtEnd)} />
          <Row
            label={t.totalCosts}
            term={TERMS.costs}
            value={`${usd(result.costs.total)} USD (spread ${usd(result.costs.spread)}, kayma ${usd(result.costs.slippage)}, komisyon ${usd(result.costs.commission)})`}
          />
        </dl>
      </div>

      <InterpretPanel b={b} inSample={inSample} onCompareRandom={onCompareRandom} />

      <h4>{t.results}</h4>
      <p className="hint">{t.measuredNote}</p>
      <dl className="kv stat-grid">
        <Row label={t.trades} term={TERMS.sample} value={String(s.trades)} />
        <Row label={t.winLoss} value={`${s.wins} / ${s.losses} / ${s.breakeven}`} />
        <Row
          label={t.winRate}
          term={TERMS.winRate}
          value={s.winRate === null ? t.none : pct(s.winRate * 100)}
        />
        <Row
          label={t.expectancy}
          term={TERMS.expectancy}
          value={s.avgR === null ? t.none : formatR(s.avgR)}
        />
        <Row label={t.totalR} term={TERMS.r} value={formatR(s.totalR)} />
        <Row
          label={t.profitFactor}
          term={TERMS.profitFactor}
          value={
            s.profitFactor === null
              ? t.none
              : s.profitFactor.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
          }
        />
        <Row label={t.maxDdR} term={TERMS.drawdownR} value={formatR(-s.maxDrawdownR)} />
        <Row
          label={t.maxDd}
          term={TERMS.drawdown}
          value={`${usd(stats.maxDrawdownUsd)} / ${pct(stats.maxDrawdownPct)}`}
        />
        <Row
          label={t.streaks}
          term={TERMS.streaks}
          value={`${s.longestWinStreak} / ${s.longestLossStreak}`}
        />
        <Row
          label={t.largest}
          value={`${s.largestWinR === null ? t.none : formatR(s.largestWinR)} / ${s.largestLossR === null ? t.none : formatR(s.largestLossR)}`}
        />
        <Row label={t.netPnl} value={`${usd(stats.netPnl)} / ${pct(stats.returnPct)}`} />
      </dl>

      <div className="chart-row">
        <EquityChart points={stats.equity} displayTz={displayTz} title={t.equityTitle} />
        <RHistogram buckets={stats.rDistribution} title={t.rDistTitle} />
      </div>

      <div className="breakdowns">
        <Breakdown title={t.monthly} rows={stats.monthly} keyLabel={(k) => k} />
        <Breakdown
          title={t.bySession}
          rows={stats.bySession}
          keyLabel={(k) => SESSION_NAMES[k] ?? tr.journal.noSession}
        />
        <Breakdown
          title={t.byWeekday}
          rows={stats.byWeekday}
          keyLabel={(k) => t.weekdays[Number(k)] ?? k}
        />
      </div>

      {result.trades.length > 0 && (
        <details>
          <summary>
            {t.tradeList} ({result.trades.length})
          </summary>
          <button
            type="button"
            className="btn"
            onClick={() =>
              saveFile(
                `trw-backtest-${run.strategy.id}-v${run.strategy.version}-${run.id}.csv`,
                backtestTradesCsv(result.trades, displayTz),
                'text/csv;charset=utf-8',
              )
            }
          >
            {tr.backup.tradesCsv}
          </button>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.col.signal}</th>
                  <th>{t.col.entry}</th>
                  <th>{t.col.exit}</th>
                  <th>{t.col.reason}</th>
                  <th>{t.col.lots}</th>
                  <th>{t.col.r}</th>
                  <th>{t.col.pnl}</th>
                  <th>{t.col.equity}</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((x) => (
                  <tr key={x.setupId}>
                    <td>{formatTime(x.signalAt, displayTz)}</td>
                    <td>{x.entryPrice}</td>
                    <td>{x.exitPrice}</td>
                    <td>
                      {t.exits[x.exit]}
                      {x.ambiguous ? ' ⚠' : ''}
                    </td>
                    <td>{x.lots}</td>
                    <td className={x.r > 0 ? 'up' : x.r < 0 ? 'down' : ''}>{formatR(x.r)}</td>
                    <td>{usd(x.pnl)}</td>
                    <td>{usd(x.equityAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
