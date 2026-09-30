import { describe, expect, it } from 'vitest';
import { isValidTimeZone, localToUtc, offsetMinutes, utcToLocal } from '../src/core/tz';

const utc = (iso: string) => Date.parse(iso);

describe('localToUtc', () => {
  it('converts an ordinary London winter time', () => {
    expect(
      localToUtc({ year: 2026, month: 1, day: 15, hour: 8, minute: 0 }, 'Europe/London'),
    ).toEqual({ kind: 'OK', utc: utc('2026-01-15T08:00:00Z') });
  });

  it('converts an ordinary London summer time (BST, UTC+1)', () => {
    expect(
      localToUtc({ year: 2026, month: 7, day: 1, hour: 8, minute: 0 }, 'Europe/London'),
    ).toEqual({
      kind: 'OK',
      utc: utc('2026-07-01T07:00:00Z'),
    });
  });

  it('reports a London spring-forward time that never existed', () => {
    // 2026-03-29: clocks jump from 01:00 to 02:00 local.
    expect(
      localToUtc({ year: 2026, month: 3, day: 29, hour: 1, minute: 30 }, 'Europe/London'),
    ).toEqual({ kind: 'NONEXISTENT' });
  });

  it('reports a London fall-back time that happened twice', () => {
    // 2026-10-25: clocks go back from 02:00 BST to 01:00 GMT, so 01:30 occurs twice.
    expect(
      localToUtc({ year: 2026, month: 10, day: 25, hour: 1, minute: 30 }, 'Europe/London'),
    ).toEqual({
      kind: 'AMBIGUOUS',
      earlier: utc('2026-10-25T00:30:00Z'),
      later: utc('2026-10-25T01:30:00Z'),
    });
  });

  it('reports a New York spring-forward time that never existed', () => {
    // 2026-03-08: clocks jump from 02:00 to 03:00 local.
    expect(
      localToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York'),
    ).toEqual({ kind: 'NONEXISTENT' });
  });

  it('reports a New York fall-back time that happened twice', () => {
    // 2026-11-01: clocks go back from 02:00 EDT to 01:00 EST.
    expect(
      localToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York'),
    ).toEqual({
      kind: 'AMBIGUOUS',
      earlier: utc('2026-11-01T05:30:00Z'),
      later: utc('2026-11-01T06:30:00Z'),
    });
  });

  it('uses a fixed +03:00 for Istanbul in winter and summer', () => {
    expect(
      localToUtc({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 }, 'Europe/Istanbul'),
    ).toEqual({ kind: 'OK', utc: utc('2026-01-15T09:00:00Z') });
    expect(
      localToUtc({ year: 2026, month: 7, day: 15, hour: 12, minute: 0 }, 'Europe/Istanbul'),
    ).toEqual({ kind: 'OK', utc: utc('2026-07-15T09:00:00Z') });
  });

  it('supports fixed-offset zones such as Etc/GMT+5 (UTC-5, no DST)', () => {
    expect(localToUtc({ year: 2026, month: 7, day: 1, hour: 17, minute: 0 }, 'Etc/GMT+5')).toEqual({
      kind: 'OK',
      utc: utc('2026-07-01T22:00:00Z'),
    });
  });

  it('keeps seconds', () => {
    expect(
      localToUtc({ year: 2026, month: 1, day: 2, hour: 3, minute: 4, second: 5 }, 'UTC'),
    ).toEqual({ kind: 'OK', utc: utc('2026-01-02T03:04:05Z') });
  });

  it('rejects impossible calendar values', () => {
    expect(() =>
      localToUtc({ year: 2026, month: 2, day: 30, hour: 0, minute: 0 }, 'UTC'),
    ).toThrow();
    expect(() =>
      localToUtc({ year: 2026, month: 1, day: 1, hour: 24, minute: 0 }, 'UTC'),
    ).toThrow();
  });

  it('rejects unknown time zones', () => {
    expect(() =>
      localToUtc({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, 'Mars/Base'),
    ).toThrow();
  });
});

describe('offsetMinutes', () => {
  it('shows the weeks when US and UK clocks are out of step', () => {
    // 2026-03-15: New York already on EDT (-4), London still on GMT (0): only 4h apart.
    const t = utc('2026-03-15T12:00:00Z');
    expect(offsetMinutes(t, 'America/New_York')).toBe(-240);
    expect(offsetMinutes(t, 'Europe/London')).toBe(0);
    // A week earlier both are on winter time: 5h apart.
    const before = utc('2026-03-07T12:00:00Z');
    expect(offsetMinutes(before, 'America/New_York')).toBe(-300);
    expect(offsetMinutes(before, 'Europe/London')).toBe(0);
  });

  it('knows Tokyo has no DST', () => {
    expect(offsetMinutes(utc('2026-01-01T00:00:00Z'), 'Asia/Tokyo')).toBe(540);
    expect(offsetMinutes(utc('2026-07-01T00:00:00Z'), 'Asia/Tokyo')).toBe(540);
  });
});

describe('utcToLocal', () => {
  it('returns wall-clock parts, ISO weekday and offset', () => {
    // 2026-11-01 05:30Z is 01:30 EDT, a Sunday (ISO weekday 7).
    expect(utcToLocal(utc('2026-11-01T05:30:00Z'), 'America/New_York')).toEqual({
      year: 2026,
      month: 11,
      day: 1,
      hour: 1,
      minute: 30,
      second: 0,
      weekday: 7,
      offsetMinutes: -240,
    });
  });

  it('round-trips with localToUtc for unambiguous times', () => {
    const t = utc('2026-06-10T14:45:00Z');
    const local = utcToLocal(t, 'Europe/London');
    expect(localToUtc(local, 'Europe/London')).toEqual({ kind: 'OK', utc: t });
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Europe/Istanbul')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
