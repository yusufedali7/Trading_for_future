import { describe, expect, it } from 'vitest';
import { seriesFromRows, type CandleRow } from '../src/data/columnar';
import { getInstrument } from '../src/instruments/registry';
import { getBuiltinSession, sessionInstances } from '../src/session/sessions';
import { sessionLevels } from '../src/session/levels';

// SYNTHETIC: hand-built 1m bars covering one London morning.
const t = (iso: string) => Date.parse(iso);
const MIN = 60_000;
const eurusd = getInstrument('EURUSD');
const london = getBuiltinSession('LONDON');

/** 1m bars from 07:55Z for n minutes; prices follow a fixed zig-zag so highs/lows are known. */
function bars(n: number): CandleRow[] {
  return Array.from({ length: n }, (_, i) => {
    const mid = 1.1 + ((i * 7) % 13) / 10_000;
    return {
      t: t('2026-01-06T07:55:00Z') + i * MIN,
      o: mid,
      h: mid + 0.0002,
      l: mid - 0.0002,
      c: mid,
    };
  });
}

const rows = bars(60); // 07:55 … 08:54
const series = seriesFromRows(rows, false);
const instances = sessionInstances(
  london,
  eurusd,
  t('2026-01-06T00:00:00Z'),
  t('2026-01-07T00:00:00Z'),
);

function expectedHighLow(from: number, to: number) {
  const inside = rows.filter((r) => r.t >= from && r.t < to);
  const high = Math.max(...inside.map((r) => r.h));
  const low = Math.min(...inside.map((r) => r.l));
  return {
    high,
    low,
    highAt: inside.find((r) => r.h === high)!.t,
    lowAt: inside.find((r) => r.l === low)!.t,
    barCount: inside.length,
  };
}

describe('sessionLevels', () => {
  it('reports the running high/low of a session that has not ended yet (not final)', () => {
    const asOf = t('2026-01-06T08:30:00Z'); // bars up to 08:29 have closed
    const [lvl] = sessionLevels(series, instances, asOf);
    expect(lvl).toMatchObject({
      sessionId: 'LONDON',
      complete: false,
      knownAt: asOf,
      ...expectedHighLow(t('2026-01-06T08:00:00Z'), asOf),
    });
  });

  it('ignores bars before the session start and bars not yet closed at asOf', () => {
    const asOf = t('2026-01-06T08:10:30Z'); // the 08:10 bar is still forming
    const [lvl] = sessionLevels(series, instances, asOf);
    expect(lvl!.barCount).toBe(10); // 08:00 … 08:09
  });

  it('marks a session complete once its end has passed and dates the levels at the end', () => {
    const asOf = t('2026-01-06T18:00:00Z');
    const [lvl] = sessionLevels(series, instances, asOf);
    expect(lvl).toMatchObject({ complete: true, knownAt: t('2026-01-06T17:00:00Z') });
  });

  it('omits sessions that have not started at asOf', () => {
    expect(sessionLevels(series, instances, t('2026-01-06T07:59:00Z'))).toEqual([]);
  });

  it('keeps a session with no data, flagged by barCount 0 and null levels', () => {
    const later = sessionInstances(
      london,
      eurusd,
      t('2026-01-07T00:00:00Z'),
      t('2026-01-08T00:00:00Z'),
    );
    const [lvl] = sessionLevels(series, later, t('2026-01-07T18:00:00Z'));
    expect(lvl).toMatchObject({ barCount: 0, high: null, low: null, highAt: null, lowAt: null });
  });

  it('never looks ahead: results at any cut-off equal results computed on data truncated there', () => {
    for (let k = 1; k <= rows.length; k++) {
      const asOf = rows[k - 1]!.t + MIN;
      const truncated = seriesFromRows(rows.slice(0, k), false);
      expect(sessionLevels(truncated, instances, asOf)).toEqual(
        sessionLevels(series, instances, asOf),
      );
    }
  });
});
