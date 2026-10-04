import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { seriesFromRows, type DataSetMeta } from '@trw/engine';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createDexieUserRepos } from '../src/storage/db-user';
import { createMemoryRepo } from '../src/storage/memory-repo';
import { toDefinition, type UserSession } from '../src/storage/sessions-repo';

// SYNTHETIC user session record.
const ict: UserSession = {
  id: 'ICT_ASIA',
  name: 'ICT Asya aralığı',
  tz: 'America/New_York',
  start: '20:00',
  end: '00:00',
  days: [7, 1, 2, 3, 4],
  version: 1,
  color: '#c9a227',
  createdAt: 5,
  updatedAt: 5,
};

describe('user sessions storage (trw-user v4)', () => {
  it('stores, lists and deletes sessions', async () => {
    const { sessions } = createDexieUserRepos({ dbName: 'trw-user-sessions-1' });
    await sessions.save(ict);
    await sessions.save({ ...ict, id: 'LDN_KZ', name: 'Londra kill zone', createdAt: 6 });
    expect((await sessions.list()).map((s) => s.id)).toEqual(['ICT_ASIA', 'LDN_KZ']);
    await sessions.delete('ICT_ASIA');
    expect((await sessions.list()).map((s) => s.id)).toEqual(['LDN_KZ']);
    expect(toDefinition(ict)).toEqual({
      id: 'ICT_ASIA',
      name: 'ICT Asya aralığı',
      tz: 'America/New_York',
      start: '20:00',
      end: '00:00',
      days: [7, 1, 2, 3, 4],
      version: 1,
    });
  });

  it('upgrades a v3 database without losing its journal', async () => {
    const name = 'trw-user-sessions-upgrade';
    const old = new Dexie(name);
    old.version(3).stores({
      prefs: 'key',
      drawings: 'id, instrument',
      levels: 'id, instrument, drawingId',
      trades: 'id, instrument',
      journal: 'id, instrument, decidedAt',
      screenshots: 'id',
    });
    await old.table('screenshots').put({ id: 'kept', mime: 'image/png', data: new ArrayBuffer(1) });
    old.close();
    const repos = createDexieUserRepos({ dbName: name });
    expect(await repos.journal.getScreenshot('kept')).toBeTruthy();
    expect(await repos.sessions.list()).toEqual([]);
  });
});

describe('candle source with user sessions', () => {
  it('adds their levels to the chart data and their boxes to the replay', async () => {
    // SYNTHETIC: 1m bars from Tue 2026-01-06 00:00Z to 10:00Z (ICT range 01:00–05:00Z inside).
    const rows = Array.from({ length: 600 }, (_, i) => {
      const r = (x: number) => Math.round(x * 1e5) / 1e5;
      const mid = r(1.1 + ((i * 7) % 13) / 10_000);
      return {
        t: Date.parse('2026-01-06T00:00:00Z') + i * 60_000,
        o: mid,
        h: r(mid + 0.0002),
        l: r(mid - 0.0002),
        c: mid,
      };
    });
    const series = seriesFromRows(rows, false);
    const repo = createMemoryRepo();
    const meta = {
      id: 'ds',
      instrument: 'EURUSD',
      baseTimeframe: '1m',
      contentHash: series.contentHash,
    } as DataSetMeta;
    await repo.saveDataset(meta, series);
    const src = createInProcessCandleSource(repo);
    const plain = await src.load(meta, '15m');
    const withIct = await src.load(meta, '15m', [toDefinition(ict)]);
    expect(plain.sessions.some((s) => s.sessionId === 'ICT_ASIA')).toBe(false);
    const box = withIct.sessions.find((s) => s.sessionId === 'ICT_ASIA')!;
    expect(box).toMatchObject({
      startUtc: Date.parse('2026-01-06T01:00:00Z'),
      endUtc: Date.parse('2026-01-06T05:00:00Z'),
      complete: true,
    });
    const tail = await src.replay(meta, '15m', Date.parse('2026-01-06T03:00:00Z'), [
      toDefinition(ict),
    ]);
    expect(tail.running.map((s) => s.sessionId)).toContain('ICT_ASIA');
  });
});
