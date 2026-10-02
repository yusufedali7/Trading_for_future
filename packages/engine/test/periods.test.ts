import { describe, expect, it } from 'vitest';
import { seriesFromRows, type CandleRow } from '../src/data/columnar';
import { periodLevels } from '../src/features/periods';
import { marketState } from '../src/instruments/hours';
import { getInstrument } from '../src/instruments/registry';

// SYNTHETIC: hourly EURUSD bars from Wed 2026-01-07 22:00Z (17:00 NY, winter) to Tue 13th,
// skipping the weekend; prices follow a fixed pattern so the highs and lows are known.
const t = (iso: string) => Date.parse(iso);
const H = 3_600_000;
const EUR = getInstrument('EURUSD');
const rows: CandleRow[] = [];
for (let x = t('2026-01-07T22:00:00Z'); x < t('2026-01-13T22:00:00Z'); x += H) {
  if (marketState(EUR, x) !== 'OPEN') continue;
  const i = rows.length;
  const mid = 1.1 + ((i * 7) % 19) / 10_000 + Math.floor(i / 24) / 1_000;
  rows.push({ t: x, o: mid, h: mid + 0.0003, l: mid - 0.0002, c: mid + 0.0001 });
}
const series = seriesFromRows(rows, false);
const asOfEnd = rows[rows.length - 1]!.t + H;

function hiLo(from: number, to: number) {
  const inside = rows.filter((r) => r.t >= from && r.t < to);
  return { high: Math.max(...inside.map((r) => r.h)), low: Math.min(...inside.map((r) => r.l)) };
}

describe('periodLevels (v1)', () => {
  const days = periodLevels(series, EUR, 'DAY', asOfEnd, '1h');

  it('gives each finished trading day (17:00 New York) its high and low, valid the next day', () => {
    const thu = days.find((d) => d.start === t('2026-01-07T22:00:00Z'))!;
    expect(thu).toEqual({
      id: `PERIOD:v1:DAY:${t('2026-01-07T22:00:00Z')}`,
      defVersion: 'v1',
      period: 'DAY',
      start: t('2026-01-07T22:00:00Z'),
      end: t('2026-01-08T22:00:00Z'),
      ...hiLo(t('2026-01-07T22:00:00Z'), t('2026-01-08T22:00:00Z')),
      knownAt: t('2026-01-08T22:00:00Z'),
      validUntil: t('2026-01-09T22:00:00Z'),
    });
  });

  it("carries Friday's levels over the weekend to Monday's trading day", () => {
    const fri = days.find((d) => d.start === t('2026-01-08T22:00:00Z'))!;
    expect(fri.validUntil).toBe(t('2026-01-12T22:00:00Z'));
  });

  it('omits the period that has not ended yet', () => {
    expect(days.map((d) => d.end).every((e) => e <= asOfEnd)).toBe(true);
    const partial = periodLevels(series, EUR, 'DAY', t('2026-01-13T12:00:00Z'), '1h');
    expect(partial.at(-1)!.end).toBe(t('2026-01-12T22:00:00Z'));
  });

  it('builds weekly levels from Sunday to Sunday 17:00 New York', () => {
    const weeks = periodLevels(series, EUR, 'WEEK', asOfEnd, '1h');
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      start: t('2026-01-04T22:00:00Z'),
      end: t('2026-01-11T22:00:00Z'),
      ...hiLo(t('2026-01-04T22:00:00Z'), t('2026-01-11T22:00:00Z')),
      validUntil: t('2026-01-18T22:00:00Z'),
    });
  });

  it('is truncation invariant', () => {
    for (let k = 1; k <= rows.length; k++) {
      const asOf = rows[k - 1]!.t + H;
      const part = seriesFromRows(rows.slice(0, k), false);
      for (const p of ['DAY', 'WEEK'] as const) {
        expect(periodLevels(part, EUR, p, asOf, '1h')).toEqual(
          periodLevels(series, EUR, p, asOfEnd, '1h').filter((x) => x.knownAt <= asOf),
        );
      }
    }
  });
});
