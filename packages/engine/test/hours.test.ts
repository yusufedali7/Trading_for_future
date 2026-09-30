import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import { marketState } from '../src/instruments/hours';

const t = (iso: string) => Date.parse(iso);
const eurusd = getInstrument('EURUSD');
const xauusd = getInstrument('XAUUSD');

describe('marketState (FX 24/5, week Sun 17:00 → Fri 17:00 New York)', () => {
  it('is open mid-week', () => {
    expect(marketState(eurusd, t('2026-01-06T15:00:00Z'))).toBe('OPEN'); // Tue 10:00 NY
  });

  it('closes at Friday 17:00 New York', () => {
    expect(marketState(eurusd, t('2026-01-09T21:59:00Z'))).toBe('OPEN'); // Fri 16:59 EST
    expect(marketState(eurusd, t('2026-01-09T22:00:00Z'))).toBe('WEEKEND'); // Fri 17:00 EST
  });

  it('is closed on Saturday', () => {
    expect(marketState(eurusd, t('2026-01-10T12:00:00Z'))).toBe('WEEKEND');
  });

  it('reopens at Sunday 17:00 New York', () => {
    expect(marketState(eurusd, t('2026-01-11T21:59:00Z'))).toBe('WEEKEND'); // Sun 16:59 EST
    expect(marketState(eurusd, t('2026-01-11T22:00:00Z'))).toBe('OPEN'); // Sun 17:00 EST
  });

  it('follows New York daylight saving time', () => {
    // In July New York is on EDT (UTC-4): Friday 17:00 NY is 21:00 UTC.
    expect(marketState(eurusd, t('2026-07-10T20:59:00Z'))).toBe('OPEN');
    expect(marketState(eurusd, t('2026-07-10T21:00:00Z'))).toBe('WEEKEND');
  });
});

describe('marketState (XAUUSD daily break 17:00-18:00 New York)', () => {
  it('is in the daily break on a weekday at 17:30 New York', () => {
    expect(marketState(xauusd, t('2026-01-06T22:30:00Z'))).toBe('DAILY_BREAK');
  });

  it('is open again at 18:00 New York', () => {
    expect(marketState(xauusd, t('2026-01-06T23:00:00Z'))).toBe('OPEN');
  });

  it('opens the week at Sunday 18:00 New York because of the break', () => {
    expect(marketState(xauusd, t('2026-01-11T22:30:00Z'))).toBe('DAILY_BREAK');
    expect(marketState(xauusd, t('2026-01-11T23:00:00Z'))).toBe('OPEN');
  });

  it('does not apply the break to EURUSD', () => {
    expect(marketState(eurusd, t('2026-01-06T22:30:00Z'))).toBe('OPEN');
  });
});
