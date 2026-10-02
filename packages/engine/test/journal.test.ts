import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import { BUILTIN_SESSIONS } from '../src/session/sessions';
import {
  activeSessions,
  filterJournal,
  journalResultOf,
  summarizeJournal,
  tradeStats,
  type JournalEntry,
} from '../src/user/journal';

const t = (iso: string) => Date.parse(iso);
const eurusd = getInstrument('EURUSD');

describe('activeSessions', () => {
  it('tags the London/New York overlap', () => {
    // Tue 2026-01-06 14:00Z: London 08-17Z, New York 13-22Z (winter)
    expect(activeSessions(BUILTIN_SESSIONS, eurusd, t('2026-01-06T14:00:00Z'))).toEqual([
      'LONDON',
      'NEW_YORK',
    ]);
  });

  it('tags Asia in the early UTC morning and nothing at the weekend', () => {
    expect(activeSessions(BUILTIN_SESSIONS, eurusd, t('2026-01-06T03:00:00Z'))).toEqual(['ASIA']);
    expect(activeSessions(BUILTIN_SESSIONS, eurusd, t('2026-01-10T12:00:00Z'))).toEqual([]);
  });
});

describe('tradeStats', () => {
  it('reports nothing meaningful for no trades, flagged as a small sample', () => {
    expect(tradeStats([])).toMatchObject({ trades: 0, winRate: null, avgR: null, lowSample: true });
  });

  it('computes win rate, average R, profit factor, streaks and drawdown in R', () => {
    // SYNTHETIC results in R
    const rs = [2, -1, -1, 3, -1, 0, 2, 2];
    const s = tradeStats(rs.map((r, i) => ({ r, ambiguous: i === 1 })));
    expect(s).toEqual({
      trades: 8,
      wins: 4,
      losses: 3,
      breakeven: 1,
      winRate: 0.5,
      avgR: 0.75,
      totalR: 6,
      profitFactor: 3,
      longestWinStreak: 2,
      longestLossStreak: 2,
      largestWinR: 3,
      largestLossR: -1,
      // cumulative: 2, 1, 0, 3, 2, 2, 4, 6 → peak 2 → trough 0
      maxDrawdownR: 2,
      ambiguous: 1,
      lowSample: true,
    });
  });

  it('has no profit factor without losses', () => {
    expect(tradeStats([{ r: 1 }, { r: 2 }]).profitFactor).toBeNull();
  });

  it('drops the small-sample warning from 30 trades on', () => {
    expect(tradeStats(Array.from({ length: 30 }, () => ({ r: 1 }))).lowSample).toBe(false);
  });
});

describe('filterJournal', () => {
  const base: JournalEntry = {
    id: 'a',
    instrument: 'EURUSD',
    decision: 'LONG',
    decidedAt: t('2026-01-06T14:00:00Z'),
    timeframe: '15m',
    sessions: ['LONDON', 'NEW_YORK'],
    tradeId: 't1',
    result: { r: 2, exitReason: 'TP', maeR: 0.2, mfeR: 2, durationMs: 3_600_000, ambiguous: false },
    strategy: 'Londra sweep',
    reason: '',
    emotion: 'CALM',
    emotionIntensity: 2,
    lesson: '',
    tags: [],
    screenshotIds: [],
    createdAt: 0,
    updatedAt: 0,
  };
  const entries: JournalEntry[] = [
    base,
    {
      ...base,
      id: 'b',
      decision: 'SHORT',
      result: { ...base.result!, r: -1, exitReason: 'SL' },
      emotion: 'FOMO',
    },
    { ...base, id: 'c', decision: 'NO_TRADE', tradeId: null, result: null, sessions: ['ASIA'] },
    { ...base, id: 'd', instrument: 'XAUUSD', decidedAt: t('2026-02-01T10:00:00Z') },
  ];
  const ids = (f: Parameters<typeof filterJournal>[1]) =>
    filterJournal(entries, f).map((e) => e.id);

  it('filters by instrument, decision, session, emotion and outcome', () => {
    expect(ids({ instrument: 'XAUUSD' })).toEqual(['d']);
    expect(ids({ decision: 'NO_TRADE' })).toEqual(['c']);
    expect(ids({ session: 'ASIA' })).toEqual(['c']);
    expect(ids({ emotion: 'FOMO' })).toEqual(['b']);
    expect(ids({ outcome: 'LOSS' })).toEqual(['b']);
    expect(ids({ outcome: 'WIN' })).toEqual(['a', 'd']);
    expect(ids({ outcome: 'NONE' })).toEqual(['c']);
  });

  it('filters by decision date range (inclusive from, exclusive to)', () => {
    expect(ids({ from: t('2026-01-07T00:00:00Z') })).toEqual(['d']);
    expect(ids({ to: t('2026-01-07T00:00:00Z') })).toEqual(['a', 'b', 'c']);
  });

  it('combines filters', () => {
    expect(ids({ instrument: 'EURUSD', outcome: 'WIN' })).toEqual(['a']);
  });
});

describe('journalResultOf', () => {
  const MIN = 60_000;
  const closed = {
    status: 'CLOSED' as const,
    entryAt: t('2026-01-06T10:00:00Z'),
    entryPrice: 1.1,
    exitAt: t('2026-01-06T10:44:00Z'),
    exitPrice: 1.102,
    exitReason: 'TP' as const,
    r: 2,
    maeR: 0.4,
    mfeR: 2,
    barsHeld: 45,
    ambiguous: false,
  };

  it('copies the measured result; duration runs to the close of the exit bar', () => {
    expect(journalResultOf(closed, MIN)).toEqual({
      r: 2,
      exitReason: 'TP',
      maeR: 0.4,
      mfeR: 2,
      durationMs: 45 * MIN,
      ambiguous: false,
    });
  });

  it('has no result for trades that never closed with a fill', () => {
    const none = {
      status: 'EXPIRED' as const,
      r: null,
      maeR: 0,
      mfeR: 0,
      barsHeld: 0,
      ambiguous: false,
    };
    expect(journalResultOf(none, MIN)).toBeNull();
    expect(journalResultOf({ ...closed, status: 'OPEN' }, MIN)).toBeNull();
  });
});

describe('summarizeJournal', () => {
  const e = (id: string, decidedAt: string, decision: JournalEntry['decision'], r: number | null) =>
    ({
      id,
      instrument: 'EURUSD',
      decision,
      decidedAt: t(decidedAt),
      timeframe: '15m',
      sessions: [],
      tradeId: r === null ? null : `t-${id}`,
      result:
        r === null
          ? null
          : {
              r,
              exitReason: r > 0 ? 'TP' : 'SL',
              maeR: 0,
              mfeR: 0,
              durationMs: 0,
              ambiguous: id === 'c',
            },
      strategy: '',
      reason: '',
      emotion: 'CALM',
      emotionIntensity: 3,
      lesson: '',
      tags: [],
      screenshotIds: [],
      createdAt: 0,
      updatedAt: 0,
    }) satisfies JournalEntry;

  it('counts decisions and measures results in decision order, ignoring "no trade" entries', () => {
    // Given newest first (as the repo lists them); in time order: +2, −1, −1, (no trade)
    const s = summarizeJournal([
      e('d', '2026-01-09T10:00:00Z', 'NO_TRADE', null),
      e('c', '2026-01-08T10:00:00Z', 'SHORT', -1),
      e('b', '2026-01-07T10:00:00Z', 'LONG', -1),
      e('a', '2026-01-06T10:00:00Z', 'LONG', 2),
    ]);
    expect(s.entries).toBe(4);
    expect(s.decisions).toEqual({ LONG: 2, SHORT: 1, NO_TRADE: 1 });
    expect(s.stats).toMatchObject({
      trades: 3,
      wins: 1,
      losses: 2,
      totalR: 0,
      longestLossStreak: 2,
      maxDrawdownR: 2,
      ambiguous: 1,
      lowSample: true,
    });
  });
});
