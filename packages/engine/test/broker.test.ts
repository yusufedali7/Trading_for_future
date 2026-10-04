import { describe, expect, it } from 'vitest';
import { detectServerOffset, mergeBrokerBars, offsetMayHaveChanged } from '../src/data/broker';
import { getInstrument } from '../src/instruments/registry';

const EUR = getInstrument('EURUSD');
const t = (iso: string) => Date.parse(iso);
const H = 3_600_000;

describe('broker server time offset', () => {
  // Tue 2026-01-06 10:00:20Z, market open.
  const now = t('2026-01-06T10:00:20Z');

  it('measures the offset from a fresh tick, to the quarter hour', () => {
    // Server shows 12:00:15 (UTC+2), tick 5 seconds old.
    expect(detectServerOffset(now / 1000 + 2 * 3600 - 5, now, EUR)).toEqual({
      ok: true,
      offsetMs: 2 * H,
    });
    expect(detectServerOffset(now / 1000 - 3, now, EUR)).toEqual({ ok: true, offsetMs: 0 });
    expect(detectServerOffset(now / 1000 + 5.5 * 3600, now, EUR)).toEqual({
      ok: true,
      offsetMs: 5.5 * H,
    });
  });

  it('refuses to guess when the market is closed or the tick is old', () => {
    expect(detectServerOffset(null, now, EUR)).toEqual({ ok: false, reason: 'NO_TICK' });
    const saturday = t('2026-01-10T12:00:00Z');
    expect(detectServerOffset(saturday / 1000 + 2 * 3600, saturday, EUR)).toEqual({
      ok: false,
      reason: 'MARKET_CLOSED',
    });
    // A tick 7 minutes old does not land on a quarter hour.
    expect(detectServerOffset(now / 1000 + 2 * 3600 - 420, now, EUR)).toEqual({
      ok: false,
      reason: 'STALE_TICK',
    });
  });

  it('warns when a DST change lies inside the fetched range', () => {
    expect(offsetMayHaveChanged(t('2026-01-05T00:00:00Z'), t('2026-01-09T00:00:00Z'))).toBe(false);
    // US clocks change on 2026-03-08.
    expect(offsetMayHaveChanged(t('2026-03-02T00:00:00Z'), t('2026-03-10T00:00:00Z'))).toBe(true);
    // Europe changes on 2026-03-29.
    expect(offsetMayHaveChanged(t('2026-03-20T00:00:00Z'), t('2026-04-02T00:00:00Z'))).toBe(true);
  });
});

describe('mergeBrokerBars', () => {
  // SYNTHETIC broker bars at server time UTC+2.
  const bar = (iso: string, c: number) => ({
    t: (t(iso) + 2 * H) / 1000,
    o: 1.1,
    h: 1.1005,
    l: 1.0995,
    c,
    v: 3,
  });

  it('converts to UTC, sorts, keeps one bar per minute and counts revisions', () => {
    const first = mergeBrokerBars(
      [],
      [bar('2026-01-06T10:01:00Z', 1.1001), bar('2026-01-06T10:00:00Z', 1.1)],
      2 * H,
    );
    expect(first.rows.map((r) => r.t)).toEqual([
      t('2026-01-06T10:00:00Z'),
      t('2026-01-06T10:01:00Z'),
    ]);
    expect(first).toMatchObject({ added: 2, revised: 0 });
    const next = mergeBrokerBars(
      first.rows,
      [bar('2026-01-06T10:01:00Z', 1.1002), bar('2026-01-06T10:02:00Z', 1.1003)],
      2 * H,
    );
    expect(next).toMatchObject({ added: 1, revised: 1 });
    expect(next.rows.map((r) => r.c)).toEqual([1.1, 1.1002, 1.1003]);
  });
});
