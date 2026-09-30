import { describe, expect, it } from 'vitest';
import type { UTCTimestamp } from 'lightweight-charts';
import { getInstrument, type ResampledCandle } from '@trw/engine';
import {
  TICK,
  fromChartTime,
  tickLabel,
  timeLabel,
  toCandleData,
  toVolumeData,
} from '../src/chart/lwc-adapter';

// SYNTHETIC: hand-written candles for adapter tests.
const t = (iso: string) => Date.parse(iso);
const eurusd = getInstrument('EURUSD');

function candle(
  iso: string,
  o: number,
  c: number,
  extra: Partial<ResampledCandle> = {},
): ResampledCandle {
  return {
    t: t(iso),
    o,
    h: Math.max(o, c) + 1,
    l: Math.min(o, c) - 1,
    c,
    v: 10,
    sourceCount: 1,
    expectedCount: 1,
    complete: true,
    ...extra,
  };
}

const COLORS = { up: '#0f0', down: '#f00', incomplete: '#888' };

describe('toCandleData', () => {
  it('feeds UTC seconds that stay strictly increasing across the New York fall-back night', () => {
    // 05:30Z and 06:30Z are both 01:30 on New York wall clocks.
    const data = toCandleData(
      [candle('2026-11-01T05:30:00Z', 1, 2), candle('2026-11-01T06:30:00Z', 2, 3)],
      COLORS,
    );
    expect(data.map((d) => d.time)).toEqual([
      t('2026-11-01T05:30:00Z') / 1000,
      t('2026-11-01T06:30:00Z') / 1000,
    ]);
    expect(data[1]!.time).toBeGreaterThan(data[0]!.time);
    expect(data[0]).toMatchObject({ open: 1, high: 3, low: 0, close: 2 });
  });

  it('greys out a candle that is still forming', () => {
    const [d] = toCandleData([candle('2026-01-06T15:00:00Z', 1, 2, { complete: false })], COLORS);
    expect(d).toMatchObject({ color: '#888', wickColor: '#888', borderColor: '#888' });
  });
});

describe('toVolumeData', () => {
  it('colours volume by candle direction', () => {
    const data = toVolumeData(
      [candle('2026-01-06T15:00:00Z', 1, 2), candle('2026-01-06T15:01:00Z', 2, 1)],
      COLORS,
    );
    expect(data?.map((d) => d.color)).toEqual(['#0f0', '#f00']);
  });

  it('returns null when the data has no volume', () => {
    const { v: _v, ...noVol } = candle('2026-01-06T15:00:00Z', 1, 2);
    expect(toVolumeData([noVol], COLORS)).toBeNull();
  });
});

describe('time labels', () => {
  it('shows intraday times in the chosen display zone', () => {
    const utc = t('2026-01-06T15:00:00Z');
    expect(timeLabel(utc, '15m', 'Europe/Istanbul', eurusd)).toBe('2026-01-06 18:00');
    expect(timeLabel(utc, '15m', 'America/New_York', eurusd)).toBe('2026-01-06 10:00');
    expect(timeLabel(utc, '15m', 'UTC', eurusd)).toBe('2026-01-06 15:00');
  });

  it('names daily candles after the trading day they close (17:00 New York)', () => {
    // The daily bucket opening Monday 17:00 NY (22:00Z) is Tuesday's trading day, in any zone.
    const start = t('2026-01-05T22:00:00Z');
    expect(timeLabel(start, '1D', 'America/New_York', eurusd)).toBe('2026-01-06');
    expect(timeLabel(start, '1D', 'Asia/Tokyo', eurusd)).toBe('2026-01-06');
  });

  it('names weekly candles after their first trading day (Monday)', () => {
    expect(timeLabel(t('2026-01-04T22:00:00Z'), '1W', 'UTC', eurusd)).toBe('2026-01-05');
  });

  it('formats axis ticks per tick type in the display zone', () => {
    const utc = t('2026-01-06T15:00:00Z');
    expect(tickLabel(utc, TICK.Time, '15m', 'Europe/Istanbul', eurusd)).toBe('18:00');
    expect(tickLabel(utc, TICK.DayOfMonth, '15m', 'Europe/Istanbul', eurusd)).toBe('6 Oca');
    expect(tickLabel(utc, TICK.Month, '15m', 'Europe/Istanbul', eurusd)).toBe('Oca');
    expect(tickLabel(utc, TICK.Year, '15m', 'Europe/Istanbul', eurusd)).toBe('2026');
  });

  it('converts chart time back to UTC milliseconds', () => {
    expect(fromChartTime(1767711600 as UTCTimestamp)).toBe(1767711600000);
  });
});
