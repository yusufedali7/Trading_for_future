import { describe, expect, it } from 'vitest';
import { getInstrument, type SupportResistanceLevel } from '@trw/engine';
import {
  formatDuration,
  levelTag,
  positionLabels,
  priceRangeLabel,
} from '../src/chart/drawing-labels';

const eurusd = getInstrument('EURUSD');
const H = 3_600_000;

describe('formatDuration', () => {
  it('uses days, hours and minutes in Turkish short form', () => {
    expect(formatDuration(2 * H)).toBe('2s 0dk');
    expect(formatDuration(26 * H + 15 * 60_000)).toBe('1g 2s');
    expect(formatDuration(45 * 60_000)).toBe('45dk');
  });
});

describe('priceRangeLabel', () => {
  it('shows signed pips, percent and duration', () => {
    expect(priceRangeLabel(eurusd, { t: 0, p: 1.085 }, { t: 2 * H, p: 1.087 })).toBe(
      '+20,0 pip · +0,18% · 2s 0dk',
    );
    expect(priceRangeLabel(eurusd, { t: 0, p: 1.087 }, { t: 45 * 60_000, p: 1.085 })).toBe(
      '−20,0 pip · −0,18% · 45dk',
    );
  });
});

describe('positionLabels', () => {
  it('labels target, stop and the reward-to-risk ratio', () => {
    expect(positionLabels(eurusd, 'POSITION_LONG', 1.085, 1.083, 1.089)).toEqual({
      target: 'Hedef: 40,0 pip',
      stop: 'Stop: 20,0 pip',
      ratio: 'R:R 2,00',
      valid: true,
    });
  });

  it('explains an invalid position instead of showing a ratio', () => {
    expect(positionLabels(eurusd, 'POSITION_LONG', 1.085, 1.087, 1.09).ratio).toBe(
      'Geçersiz: stop yanlış tarafta',
    );
  });
});

describe('levelTag', () => {
  it('names kind, timeframe and status in words (not colour)', () => {
    const level = { kind: 'SUPPORT', timeframe: '4h', status: 'BROKEN' } as SupportResistanceLevel;
    expect(levelTag(level)).toBe('Destek · 4h · Kırıldı');
  });
});
