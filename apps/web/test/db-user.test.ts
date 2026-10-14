import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, createDexiePrefsRepo, type Prefs } from '../src/storage/db-user';

let n = 0;
const fresh = () => createDexiePrefsRepo({ dbName: `trw-user-test-${n++}` });

describe('user preferences repo', () => {
  it('returns defaults before anything is saved', async () => {
    expect(await fresh().load()).toEqual(DEFAULT_PREFS);
  });

  it('defaults to 15m, Istanbul time, all sessions and a few candidate layers visible', () => {
    expect(DEFAULT_PREFS).toEqual({
      datasetId: null,
      timeframe: '15m',
      displayTz: 'Europe/Istanbul',
      sessions: ['ASIA', 'LONDON', 'NEW_YORK'],
      features: ['SWING', 'STRUCTURE', 'PREV_DAY'],
      paperFeed: { instrument: 'EURUSD', brokerSymbol: '', auto: false },
      lastBackupAt: null,
      learning: { completed: [], hideHint: false, exercises: [] },
      indicators: {
        sma: { on: false, period: 20 },
        ema: { on: false, period: 20 },
        bollinger: { on: false, period: 20, k: 2 },
        vwap: { on: false },
        oscillator: 'NONE',
        rsi: { period: 14 },
        macd: { fast: 12, slow: 26, signal: 9 },
      },
    });
  });

  it('persists and merges partial updates', async () => {
    const repo = fresh();
    await repo.save({ timeframe: '4h' });
    await repo.save({ displayTz: 'America/New_York' });
    await repo.save({ sessions: ['LONDON'] });
    expect(await repo.load()).toEqual({
      ...DEFAULT_PREFS,
      timeframe: '4h',
      displayTz: 'America/New_York',
      sessions: ['LONDON'],
    });
  });

  it('fills learning fields added later into older stored prefs (D74 regression)', async () => {
    const repo = fresh();
    // What a D73 build stored: learning progress without the later `exercises` list.
    await repo.save({
      learning: { completed: ['price-pip-spread'], hideHint: true },
    } as unknown as Partial<Prefs>);
    expect((await repo.load()).learning).toEqual({
      completed: ['price-pip-spread'],
      hideHint: true,
      exercises: [],
    });
  });
});
