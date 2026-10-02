import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import { buildOrder, defaultDraft, type OrderDraft } from '../src/execution/order-builder';
import { orderProblem } from '../src/execution/trade-sim';

const EUR = getInstrument('EURUSD');
const XAU = getInstrument('XAUUSD');
const T = Date.parse('2026-01-06T10:00:00Z');
const ctx = { placedAt: T, lastClose: 1.10003, barMs: 15 * 60_000 };
const draft = (d: Partial<OrderDraft>): OrderDraft => ({ ...defaultDraft('LONG'), ...d });

describe('buildOrder', () => {
  it('defaults to a market order with a 20 pip stop and a 40 pip target from the last close', () => {
    expect(buildOrder(EUR, defaultDraft('LONG'), ctx)).toEqual({
      order: {
        direction: 'LONG',
        type: 'MARKET',
        placedAt: T,
        referencePrice: 1.10003,
        stop: 1.09803,
        target: 1.10403,
        expiresAt: null,
      },
    });
  });

  it('mirrors pip distances for shorts', () => {
    const r = buildOrder(EUR, defaultDraft('SHORT'), ctx);
    expect(r).toMatchObject({ order: { stop: 1.10203, target: 1.09603 } });
  });

  it('measures pips from the trigger price of limit and stop orders and sets the expiry', () => {
    const r = buildOrder(EUR, draft({ type: 'LIMIT', price: 1.0995, expireBars: 4 }), ctx);
    expect(r).toMatchObject({
      order: { price: 1.0995, stop: 1.0975, target: 1.1035, expiresAt: T + 4 * ctx.barMs },
    });
    const never = buildOrder(EUR, draft({ type: 'STOP', price: 1.101, expireBars: null }), ctx);
    expect(never).toMatchObject({ order: { expiresAt: null } });
  });

  it('uses the instrument pip size (XAUUSD: 0.1)', () => {
    const r = buildOrder(XAU, defaultDraft('LONG'), { ...ctx, lastClose: 2650.55 });
    expect(r).toMatchObject({ order: { stop: 2648.55, target: 2654.55 } });
  });

  it('takes absolute prices in PRICE mode, rounded to the tick', () => {
    const r = buildOrder(EUR, draft({ unit: 'PRICE', stop: 1.099001, target: 1.102 }), ctx);
    expect(r).toMatchObject({ order: { stop: 1.099, target: 1.102 } });
  });

  it('reports what is wrong instead of building a bad order', () => {
    expect(buildOrder(EUR, draft({ type: 'LIMIT', price: null }), ctx)).toEqual({
      problem: 'NO_PRICE',
    });
    expect(buildOrder(EUR, draft({ stop: 0 }), ctx)).toEqual({ problem: 'NOT_POSITIVE' });
    expect(buildOrder(EUR, draft({ unit: 'PRICE', stop: 1.2, target: 1.3 }), ctx)).toEqual({
      problem: 'STOP_SIDE',
    });
    expect(buildOrder(EUR, draft({ unit: 'PRICE', stop: 1.09, target: 1.0 }), ctx)).toEqual({
      problem: 'TARGET_SIDE',
    });
    expect(buildOrder(EUR, draft({ type: 'STOP', price: 1.1, expireBars: 0 }), ctx)).toEqual({
      problem: 'EXPIRY',
    });
  });
});

describe('orderProblem', () => {
  it('accepts a well-formed order and names the first problem otherwise', () => {
    const base = {
      direction: 'SHORT' as const,
      type: 'MARKET' as const,
      placedAt: T,
      referencePrice: 1.1,
      stop: 1.101,
      target: 1.099,
      expiresAt: null,
    };
    expect(orderProblem(base)).toBeNull();
    expect(orderProblem({ ...base, stop: 1.1 })).toBe('STOP_SIDE');
    expect(orderProblem({ ...base, target: 1.1 })).toBe('TARGET_SIDE');
    expect(orderProblem({ ...base, type: 'LIMIT' })).toBe('NO_PRICE');
  });
});
