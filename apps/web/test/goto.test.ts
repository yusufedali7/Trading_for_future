import { describe, expect, it } from 'vitest';
import { indexAtOrAfter, startOfLocalDay } from '../src/chart/goto';

describe('go to date', () => {
  const times = [100, 200, 300, 400];

  it('finds the first candle at or after the target time', () => {
    expect(indexAtOrAfter(times, 200)).toBe(1);
    expect(indexAtOrAfter(times, 250)).toBe(2);
    expect(indexAtOrAfter(times, 50)).toBe(0);
  });

  it('returns the last index when the target is after the data', () => {
    expect(indexAtOrAfter(times, 999)).toBe(3);
  });

  it('interprets a picked date as midnight in the display zone', () => {
    expect(startOfLocalDay('2026-01-06', 'Europe/Istanbul')).toBe(
      Date.parse('2026-01-05T21:00:00Z'),
    );
    expect(startOfLocalDay('2026-07-06', 'America/New_York')).toBe(
      Date.parse('2026-07-06T04:00:00Z'),
    );
    expect(startOfLocalDay('not-a-date', 'UTC')).toBeNull();
  });
});
