import { describe, expect, it } from 'vitest';
import { seriesFromRows } from '../src/data/columnar';
import { simulateTrade, type TradeOrder } from '../src/execution/trade-sim';

// SYNTHETIC: hand-written 1m BID bars; prices in "points" around 1.1000 for readability.
const MIN = 60_000;
const T0 = Date.parse('2026-01-06T10:00:00Z');
const P = (pips: number) => Math.round((1.1 + pips / 10_000) * 100_000) / 100_000;

/** Bars given as [open, high, low, close] in pips relative to 1.1000, one per minute from T0. */
function bars(...ohlc: [number, number, number, number][]) {
  return seriesFromRows(
    ohlc.map(([o, h, l, c], i) => ({ t: T0 + i * MIN, o: P(o), h: P(h), l: P(l), c: P(c) })),
    false,
  );
}
const at = (i: number) => T0 + i * MIN; // open time of bar i
const NO_COST = { spread: 0, slippage: 0 };

function order(o: Partial<TradeOrder>): TradeOrder {
  return {
    direction: 'LONG',
    type: 'MARKET',
    placedAt: at(1),
    referencePrice: P(0),
    stop: P(-10),
    target: P(20),
    expiresAt: null,
    ...o,
  };
}

const run = (s: ReturnType<typeof bars>, o: TradeOrder, cutoff: number, extra = {}) =>
  simulateTrade(o, s, { baseMs: MIN, cutoff, costs: NO_COST, ambiguity: 'STOP_FIRST', ...extra });

describe('market orders', () => {
  const s = bars(
    [0, 1, -1, 0], // 0: before the decision
    [1, 3, 0, 2], // 1: fills at its open (1)
    [2, 10, 1, 9], // 2
    [9, 22, 8, 20], // 3: target 20 hit
    [20, 25, 19, 24],
  );

  it('fills at the open of the first bar after the decision and exits at the target', () => {
    expect(run(s, order({}), at(5))).toMatchObject({
      status: 'CLOSED',
      entryAt: at(1),
      entryPrice: P(1),
      exitAt: at(3),
      exitPrice: P(20),
      exitReason: 'TP',
      ambiguous: false,
    });
    // risk = entry 1 → stop -10 = 11 pips; reward 19 pips → 19/11 R
    expect(run(s, order({}), at(5)).r).toBeCloseTo(19 / 11, 6);
  });

  it('stays open, marked to the last closed bar, while the cursor has not reached the exit', () => {
    const r = run(s, order({}), at(3)); // bars 1 and 2 closed
    expect(r).toMatchObject({ status: 'OPEN', markPrice: P(9) });
    expect(r.r).toBeCloseTo(8 / 11, 6);
  });

  it('is pending until the first bar after the decision has closed', () => {
    expect(run(s, order({}), at(1) + 30_000).status).toBe('PENDING');
  });
});

describe('stop loss and ambiguity', () => {
  it('exits at the stop for -1R', () => {
    const s = bars([0, 1, -1, 0], [0, 1, -11, -5]);
    expect(run(s, order({ placedAt: at(1), referencePrice: P(0) }), at(2))).toMatchObject({
      status: 'CLOSED',
      exitReason: 'SL',
      exitPrice: P(-10),
      r: -1,
    });
  });

  it('assumes the stop came first when one bar touches both stop and target (and flags it)', () => {
    const s = bars([0, 1, -1, 0], [0, 21, -11, 0]);
    expect(run(s, order({}), at(2))).toMatchObject({ exitReason: 'SL', r: -1, ambiguous: true });
  });

  it('can be configured to assume the target first', () => {
    const s = bars([0, 1, -1, 0], [0, 21, -11, 0]);
    expect(run(s, order({}), at(2), { ambiguity: 'TARGET_FIRST' })).toMatchObject({
      exitReason: 'TP',
      ambiguous: true,
    });
  });

  it('fills a gap through the stop at the (worse) open', () => {
    const s = bars([0, 1, -1, 0], [0, 2, -2, 1], [-15, -14, -16, -15]);
    const r = run(s, order({}), at(3));
    expect(r).toMatchObject({ exitReason: 'SL', exitPrice: P(-15) });
    expect(r.r).toBeCloseTo(-1.5, 6);
  });

  it('fills a gap through the target at the (better) open', () => {
    const s = bars([0, 1, -1, 0], [0, 2, -2, 1], [25, 26, 24, 25]);
    expect(run(s, order({}), at(3))).toMatchObject({ exitReason: 'TP', exitPrice: P(25) });
  });
});

describe('limit and stop entries', () => {
  it('fills a buy limit only when price comes down to it', () => {
    const s = bars([0, 1, -1, 0], [0, 2, -2, 0], [0, 1, -5, -4], [-4, 30, -4, 25]);
    const o = order({ type: 'LIMIT', price: P(-5), stop: P(-15), target: P(25) });
    expect(run(s, o, at(4))).toMatchObject({
      entryAt: at(2),
      entryPrice: P(-5),
      exitReason: 'TP',
      r: 3,
    });
  });

  it('fills a buy limit at the open when price gaps below it', () => {
    const s = bars([0, 1, -1, 0], [-8, -7, -9, -8]);
    const o = order({ type: 'LIMIT', price: P(-5), stop: P(-15), target: P(25) });
    expect(run(s, o, at(2))).toMatchObject({ status: 'OPEN', entryPrice: P(-8) });
  });

  it('counts a stop touched on the entry bar of a limit order but not a target (pessimistic)', () => {
    const s = bars([0, 1, -1, 0], [0, 30, -16, 0]);
    const o = order({ type: 'LIMIT', price: P(-5), stop: P(-15), target: P(25) });
    expect(run(s, o, at(2))).toMatchObject({ exitReason: 'SL', ambiguous: true });
  });

  it('triggers a buy stop when price rises to it, with slippage', () => {
    const s = bars([0, 1, -1, 0], [0, 6, 0, 5]);
    const o = order({ type: 'STOP', price: P(5), stop: P(-5), target: P(25) });
    const r = simulateTrade(o, s, {
      baseMs: MIN,
      cutoff: at(2),
      costs: { spread: 0, slippage: 0.0001 },
      ambiguity: 'STOP_FIRST',
    });
    expect(r).toMatchObject({ status: 'OPEN', entryPrice: P(6) });
  });

  it('expires an unfilled order', () => {
    const s = bars([0, 1, -1, 0], [0, 2, -2, 0], [0, 2, -2, 0], [0, 2, -9, 0]);
    const o = order({ type: 'LIMIT', price: P(-8), expiresAt: at(3) });
    expect(run(s, o, at(4))).toMatchObject({ status: 'EXPIRED' });
  });
});

describe('spread', () => {
  it('buys at the ask (bid + spread) and sells longs at the bid', () => {
    const s = bars([0, 1, -1, 0], [0, 25, 0, 20]);
    const r = simulateTrade(order({}), s, {
      baseMs: MIN,
      cutoff: at(2),
      costs: { spread: 0.0002, slippage: 0 },
      ambiguity: 'STOP_FIRST',
    });
    expect(r).toMatchObject({ entryPrice: P(2), exitPrice: P(20), exitReason: 'TP' });
  });

  it('applies slippage to stop-loss and manual exits, not to target (limit) exits (D8)', () => {
    const slip = { spread: 0, slippage: 0.0001 };
    const opts = { baseMs: MIN, cutoff: at(3), costs: slip, ambiguity: 'STOP_FIRST' as const };
    // Long market fill at 0 + 1 slip = P(1); stop P(-10) hit in bar 2 → exit P(-11).
    const stopped = bars([0, 1, -1, 0], [0, 2, -1, 1], [1, 2, -12, -5]);
    expect(simulateTrade(order({}), stopped, opts)).toMatchObject({
      exitReason: 'SL',
      entryPrice: P(1),
      exitPrice: P(-11),
    });
    // Target exits at the target price exactly.
    const won = bars([0, 1, -1, 0], [0, 2, -1, 1], [1, 25, 0, 22]);
    expect(simulateTrade(order({}), won, opts)).toMatchObject({
      exitReason: 'TP',
      exitPrice: P(20),
    });
    // Manual close at the last close (1) minus slippage.
    const open = bars([0, 1, -1, 0], [0, 2, -1, 1], [1, 2, 0, 1]);
    expect(simulateTrade(order({}), open, { ...opts, closeAt: at(3) })).toMatchObject({
      exitReason: 'MANUAL',
      exitPrice: P(0),
    });
  });

  it('closes shorts at the ask: the stop triggers when bid + spread reaches it', () => {
    const s = bars([0, 1, -1, 0], [0, 9, -1, 5]);
    const short = order({ direction: 'SHORT', stop: P(10), target: P(-20) });
    const r = simulateTrade(short, s, {
      baseMs: MIN,
      cutoff: at(2),
      costs: { spread: 0.0002, slippage: 0 },
      ambiguity: 'STOP_FIRST',
    });
    expect(r).toMatchObject({ exitReason: 'SL', exitPrice: P(10), r: -1 });
  });
});

describe('manual close, excursions and validation', () => {
  const s = bars([0, 1, -1, 0], [0, 4, -3, 2], [2, 6, 1, 5], [5, 7, 3, 4]);

  it('closes manually at the close of the last bar before the close time', () => {
    expect(run(s, order({}), at(4), { closeAt: at(3) })).toMatchObject({
      status: 'CLOSED',
      exitReason: 'MANUAL',
      exitAt: at(2),
      exitPrice: P(5),
      r: 0.5,
    });
  });

  it('measures maximum adverse and favourable excursion in R', () => {
    const r = run(s, order({}), at(4));
    expect(r.maeR).toBeCloseTo(0.3, 6); // low -3 vs entry 0, risk 10
    expect(r.mfeR).toBeCloseTo(0.7, 6); // high 7
  });

  it('rejects a long whose stop is not below the entry reference', () => {
    expect(run(s, order({ stop: P(5) }), at(4)).status).toBe('INVALID');
  });

  it('never uses bars after the cursor: results at each cut-off equal results on truncated data', () => {
    const long = bars(
      [0, 1, -1, 0],
      [0, 4, -3, 2],
      [2, 6, 1, 5],
      [5, 22, 3, 21],
      [21, 23, -12, -11],
    );
    for (let k = 1; k <= long.length; k++) {
      const cutoff = at(k);
      const truncated = bars(
        ...(
          [
            [0, 1, -1, 0],
            [0, 4, -3, 2],
            [2, 6, 1, 5],
            [5, 22, 3, 21],
            [21, 23, -12, -11],
          ] as [number, number, number, number][]
        ).slice(0, k),
      );
      expect(run(truncated, order({}), cutoff)).toEqual(run(long, order({}), cutoff));
    }
  });
});
