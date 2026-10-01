import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import {
  BUILTIN_SESSIONS,
  getBuiltinSession,
  sessionInstances,
  type SessionDefinition,
} from '../src/session/sessions';

const t = (iso: string) => Date.parse(iso);
const eurusd = getInstrument('EURUSD');
const london = getBuiltinSession('LONDON');
const newYork = getBuiltinSession('NEW_YORK');
const asia = getBuiltinSession('ASIA');

function oneDay(def: SessionDefinition, isoDay: string) {
  return sessionInstances(def, eurusd, t(`${isoDay}T00:00:00Z`), t(`${isoDay}T23:59:59Z`)).filter(
    (s) => s.date === isoDay,
  );
}

describe('built-in session definitions', () => {
  it('defines Asia (Tokyo), London and New York in their own local time', () => {
    expect(BUILTIN_SESSIONS.map((s) => [s.id, s.tz, s.start, s.end])).toEqual([
      ['ASIA', 'Asia/Tokyo', '09:00', '18:00'],
      ['LONDON', 'Europe/London', '08:00', '17:00'],
      ['NEW_YORK', 'America/New_York', '08:00', '17:00'],
    ]);
  });
});

describe('sessionInstances', () => {
  it('places London at 08:00-17:00 UTC in winter (GMT)', () => {
    expect(oneDay(london, '2026-01-06')).toEqual([
      {
        sessionId: 'LONDON',
        version: 1,
        date: '2026-01-06',
        startUtc: t('2026-01-06T08:00:00Z'),
        endUtc: t('2026-01-06T17:00:00Z'),
      },
    ]);
  });

  it('moves London one hour earlier in UTC in summer (BST)', () => {
    const [s] = oneDay(london, '2026-07-07');
    expect([s!.startUtc, s!.endUtc]).toEqual([
      t('2026-07-07T07:00:00Z'),
      t('2026-07-07T16:00:00Z'),
    ]);
  });

  it('handles the weeks when US and UK clocks are out of step', () => {
    // 2026-03-16: New York already on EDT, London still on GMT.
    const [ny] = oneDay(newYork, '2026-03-16');
    const [ldn] = oneDay(london, '2026-03-16');
    expect(ny!.startUtc).toBe(t('2026-03-16T12:00:00Z'));
    expect(ldn!.startUtc).toBe(t('2026-03-16T08:00:00Z'));
    // London/New York overlap is 5 hours that week instead of the usual 4.
    expect((ldn!.endUtc - ny!.startUtc) / 3_600_000).toBe(5);
  });

  it('keeps Tokyo at 00:00-09:00 UTC all year (no DST)', () => {
    const [w] = oneDay(asia, '2026-01-06');
    const [s] = oneDay(asia, '2026-07-07');
    expect([w!.startUtc, w!.endUtc]).toEqual([
      t('2026-01-06T00:00:00Z'),
      t('2026-01-06T09:00:00Z'),
    ]);
    expect([s!.startUtc, s!.endUtc]).toEqual([
      t('2026-07-07T00:00:00Z'),
      t('2026-07-07T09:00:00Z'),
    ]);
  });

  it('supports sessions that cross local midnight', () => {
    const range: SessionDefinition = {
      id: 'NY_EVENING',
      name: 'NY akşam',
      tz: 'America/New_York',
      start: '20:00',
      end: '00:00',
      days: [1, 2, 3, 4, 5],
      version: 1,
    };
    const all = sessionInstances(
      range,
      eurusd,
      t('2026-01-06T00:00:00Z'),
      t('2026-01-08T00:00:00Z'),
    );
    const tue = all.find((s) => s.date === '2026-01-06')!;
    expect([tue.startUtc, tue.endUtc]).toEqual([
      t('2026-01-07T01:00:00Z'),
      t('2026-01-07T05:00:00Z'),
    ]);
  });

  it('skips sessions while the market is closed (weekend)', () => {
    const everyDay: SessionDefinition = { ...london, id: 'LONDON_7', days: [1, 2, 3, 4, 5, 6, 7] };
    const week = sessionInstances(
      everyDay,
      eurusd,
      t('2026-01-05T00:00:00Z'),
      t('2026-01-12T00:00:00Z'),
    );
    expect(week.map((s) => s.date)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
    ]);
  });

  it('only returns sessions that overlap the requested range, in start order', () => {
    const all = sessionInstances(
      london,
      eurusd,
      t('2026-01-06T12:00:00Z'),
      t('2026-01-07T09:00:00Z'),
    );
    expect(all.map((s) => s.date)).toEqual(['2026-01-06', '2026-01-07']);
  });

  it('shifts a start time that falls in the spring-forward gap to after the gap', () => {
    const odd: SessionDefinition = {
      id: 'GAP',
      name: 'gap',
      tz: 'America/New_York',
      start: '02:30',
      end: '04:00',
      days: [7],
      version: 1,
    };
    // DST changes happen on Sunday while FX is closed, so use an always-open market here.
    const alwaysOpen = { ...eurusd, tradingHours: { kind: 'ALWAYS' as const } };
    // 2026-03-08 02:30 does not exist in New York; it becomes 03:30 EDT (07:30Z).
    const [s] = sessionInstances(
      odd,
      alwaysOpen,
      t('2026-03-08T00:00:00Z'),
      t('2026-03-09T00:00:00Z'),
    );
    expect(s?.startUtc).toBe(t('2026-03-08T07:30:00Z'));
  });
});
