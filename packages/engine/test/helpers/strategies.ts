import { defaultSpec, type StrategySpec } from '../../src/strategy/schema';

/** London sweep → MSS → FVG long, as in CLAUDE.md (example strategy, not advice). */
export const LONDON_SWEEP: StrategySpec = {
  ...defaultSpec(),
  window: { start: '08:00', end: '11:00', tz: 'Europe/London' },
  steps: [
    { id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH', levels: ['ASIA_LOW'] },
    { id: 'mss', type: 'STRUCTURE_BREAK', direction: 'BULLISH', maxBars: 12 },
    { id: 'fvg', type: 'FVG', direction: 'BULLISH', maxBars: 6 },
  ],
  entry: { type: 'LIMIT_AT', ref: 'fvg.top', expireBars: 8 },
  stop: { type: 'BEYOND_REF', ref: 'sweep.extreme', bufferPips: 1 },
  target: { type: 'R_MULTIPLE', r: 2 },
};
