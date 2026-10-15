import { vi } from 'vitest';

/**
 * App tests render the whole app and compute features and backtests in-process. When the full
 * suite runs many jsdom files in parallel on a busy, low-memory machine, that can take well over
 * the 1 s default of `vi.waitFor` / `findBy*`. A longer window only waits longer: the assertion
 * still fails if the condition never holds.
 */
export const LONG_WAIT_MS = 8000;

export const waitLong = <T>(fn: () => T | Promise<T>) => vi.waitFor(fn, { timeout: LONG_WAIT_MS });
