import { formatTimeUtc } from '../../format';
import { tr } from '../../i18n/tr';
import type { AnalysisSummary } from '../../import/session';

const ISSUE_ROWS = [
  'parseErrors',
  'dstIssues',
  'identicalDuplicates',
  'conflictingDuplicates',
  'outOfOrder',
  'closedMarketCandles',
  'invalidPriceRows',
  'precisionOverflow',
] as const;

export function ValidationReportView({ summary }: { summary: AnalysisSummary }) {
  const { counts } = summary;
  const hiddenGaps = counts.gaps - summary.samples.gaps.length;
  return (
    <section aria-labelledby="report-title" className="report">
      <h3 id="report-title">{tr.import.reportTitle}</h3>
      <dl className="kv">
        <dt>{tr.report.records}</dt>
        <dd>{summary.recordCount.toLocaleString('tr-TR')}</dd>
        <dt>{tr.report.range}</dt>
        <dd>
          {summary.range
            ? `${formatTimeUtc(summary.range.from)} → ${formatTimeUtc(summary.range.to)}`
            : '—'}
        </dd>
        <dt>{tr.report.timeframe}</dt>
        <dd>{summary.inferredTimeframe ?? tr.report.unknown}</dd>
        <dt>{tr.report.gaps}</dt>
        <dd>{tr.report.gapsValue(counts.gaps, counts.missingBars)}</dd>
        <dt>{tr.report.closedGaps}</dt>
        <dd>{tr.report.closedGapsValue(counts.closedMarketGaps)}</dd>
        {ISSUE_ROWS.filter((k) => counts[k] > 0).map((k) => (
          <div key={k} className="kv-row warn">
            <dt>{tr.report[k]}</dt>
            <dd>{counts[k].toLocaleString('tr-TR')}</dd>
          </div>
        ))}
      </dl>
      {summary.samples.gaps.length > 0 && (
        <ul className="gap-list">
          {summary.samples.gaps.map((g) => (
            <li key={g.from}>
              {tr.report.gapLine(formatTimeUtc(g.from), formatTimeUtc(g.to), g.missingBars)}
            </li>
          ))}
          {hiddenGaps > 0 && <li className="muted">{tr.report.moreGaps(hiddenGaps)}</li>}
        </ul>
      )}
    </section>
  );
}
