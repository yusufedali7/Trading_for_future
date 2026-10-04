import { describe, expect, it } from 'vitest';
import { isValidTimeZone } from '../src/core/tz';
import { seriesFromRows } from '../src/data/columnar';
import { detectSweeps, liquidityLevels } from '../src/features/sweep';
import { getInstrument } from '../src/instruments/registry';
import { sessionLevels } from '../src/session/levels';
import {
  allSessionDefs,
  sessionInstances,
  validateSessionDefinition,
  type SessionDefinition,
} from '../src/session/sessions';
import { BAR_MS, bars } from './helpers/synthetic-bars';

const EUR = getInstrument('EURUSD');
const t = (iso: string) => Date.parse(iso);

/** ICT-style Asia range: 20:00–00:00 New York, Sunday to Thursday evenings. */
const ICT_ASIA: SessionDefinition = {
  id: 'ICT_ASIA',
  name: 'ICT Asya aralığı',
  tz: 'America/New_York',
  start: '20:00',
  end: '00:00',
  days: [7, 1, 2, 3, 4],
  version: 1,
};

describe('user session definitions', () => {
  it('validates ids, names, time zones, times and days', () => {
    const v = (d: Partial<SessionDefinition>, others: string[] = []) =>
      validateSessionDefinition({ ...ICT_ASIA, ...d }, others, isValidTimeZone);
    expect(v({})).toEqual([]);
    expect(v({ id: 'ict asia' })).toEqual(['BAD_ID']);
    expect(v({ id: 'ASIA' })).toEqual(['RESERVED_ID']);
    expect(v({ id: 'SWING' })).toEqual(['RESERVED_ID']);
    expect(v({}, ['ICT_ASIA'])).toEqual(['DUPLICATE_ID']);
    expect(v({ name: ' ' })).toEqual(['NO_NAME']);
    expect(v({ tz: 'Mars/Base' })).toEqual(['BAD_TZ']);
    expect(v({ start: '24:00' })).toEqual(['BAD_TIME']);
    expect(v({ end: '20:00' })).toEqual(['SAME_TIME']);
    expect(v({ days: [] })).toEqual(['NO_DAYS']);
    expect(allSessionDefs([ICT_ASIA]).map((d) => d.id)).toEqual([
      'ASIA',
      'LONDON',
      'NEW_YORK',
      'ICT_ASIA',
    ]);
  });

  it('places the ICT Asia range across midnight and DST, Sunday to Thursday evenings', () => {
    // Week of 2026-01-04 (winter, NY = UTC−5) and of 2026-03-15 (US already on summer time).
    const winter = sessionInstances(
      ICT_ASIA,
      EUR,
      t('2026-01-04T00:00:00Z'),
      t('2026-01-10T00:00:00Z'),
    );
    expect(
      winter.map((s) => [
        s.date,
        new Date(s.startUtc).toISOString(),
        new Date(s.endUtc).toISOString(),
      ]),
    ).toEqual([
      ['2026-01-04', '2026-01-05T01:00:00.000Z', '2026-01-05T05:00:00.000Z'],
      ['2026-01-05', '2026-01-06T01:00:00.000Z', '2026-01-06T05:00:00.000Z'],
      ['2026-01-06', '2026-01-07T01:00:00.000Z', '2026-01-07T05:00:00.000Z'],
      ['2026-01-07', '2026-01-08T01:00:00.000Z', '2026-01-08T05:00:00.000Z'],
      ['2026-01-08', '2026-01-09T01:00:00.000Z', '2026-01-09T05:00:00.000Z'],
    ]);
    const summer = sessionInstances(
      ICT_ASIA,
      EUR,
      t('2026-03-15T00:00:00Z'),
      t('2026-03-16T12:00:00Z'),
    );
    expect(new Date(summer[0]!.startUtc).toISOString()).toBe('2026-03-16T00:00:00.000Z');
  });

  it('turns a finished user session into levels valid until it starts again', () => {
    // SYNTHETIC: 1m bars covering the 2026-01-06 range (01:00–05:00Z) and the London morning.
    const rows = Array.from({ length: 10 * 60 }, (_, i) => {
      const r = (x: number) => Math.round(x * 1e5) / 1e5;
      const mid = r(1.1 + ((i * 7) % 13) / 10_000);
      return {
        t: t('2026-01-06T01:00:00Z') + i * 60_000,
        o: mid,
        h: r(mid + 0.0002),
        l: r(mid - 0.0002),
        c: mid,
      };
    });
    const series = seriesFromRows(rows, false);
    const inst = sessionInstances(
      ICT_ASIA,
      EUR,
      t('2026-01-06T00:00:00Z'),
      t('2026-01-06T12:00:00Z'),
    );
    const levels = liquidityLevels(EUR, {
      swings: [],
      periods: [],
      sessions: sessionLevels(series, inst, t('2026-01-06T11:00:00Z')),
      sessionDefs: allSessionDefs([ICT_ASIA]),
      barMs: BAR_MS,
    });
    expect(levels.map((l) => [l.kind, l.price, l.knownAt, l.validUntil])).toEqual([
      ['ICT_ASIA_HIGH', 1.1014, t('2026-01-06T05:00:00Z'), t('2026-01-07T01:00:00Z')],
      ['ICT_ASIA_LOW', 1.0998, t('2026-01-06T05:00:00Z'), t('2026-01-07T01:00:00Z')],
    ]);
    // A London-morning 15m bar wicks below the range low and closes back above it.
    const b = bars([[1.1, 1.1003, 1.0995, 1.1001]]);
    const londonBar = { ...b, t: [t('2026-01-06T08:00:00Z')], end: [t('2026-01-06T08:15:00Z')] };
    expect(detectSweeps(londonBar, levels)).toMatchObject([
      { levelKind: 'ICT_ASIA_LOW', direction: 'BULLISH', level: 1.0998 },
    ]);
  });
});
