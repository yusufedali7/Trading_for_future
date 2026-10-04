import {
  ENGINE_VERSION,
  detectServerOffset,
  getInstrument,
  mergeBrokerBars,
  offsetMayHaveChanged,
  seriesFromRows,
  validateRecords,
  type BrokerBar,
  type CandleRow,
  type DataSetMeta,
} from '@trw/engine';
import type { MarketRepo } from '../../storage/market-repo';

export const BRIDGE_URL = 'http://127.0.0.1:8765';

export interface BridgeStatus {
  bridge: string;
  account: { server: string; mode: 'DEMO'; currency: string };
  symbol: string;
  lastTickServerSec: number | null;
  utcNowMs: number;
}

/** Why the bridge could not be used; shown to the user in Turkish. */
export type FeedProblem =
  | 'BRIDGE_DOWN'
  | 'NOT_CONNECTED'
  | 'NOT_DEMO'
  | 'UNKNOWN_SYMBOL'
  | 'NO_DATA'
  | 'NO_TICK'
  | 'MARKET_CLOSED'
  | 'STALE_TICK'
  | 'BRIDGE_ERROR';

export class FeedError extends Error {
  constructor(readonly problem: FeedProblem) {
    super(problem);
  }
}

export interface Mt5Client {
  status(symbol: string): Promise<BridgeStatus>;
  rates(symbol: string, count: number): Promise<BrokerBar[]>;
}

/** Talks to the local, read-only MT5 bridge (tools/mt5-bridge). */
export function createMt5Client(
  base = BRIDGE_URL,
  fetchFn: typeof fetch = (...a) => fetch(...a),
): Mt5Client {
  const get = async <T>(path: string): Promise<T> => {
    let res: Response;
    try {
      res = await fetchFn(`${base}${path}`, { cache: 'no-store' });
    } catch {
      throw new FeedError('BRIDGE_DOWN');
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) {
      const known: FeedProblem[] = ['NOT_CONNECTED', 'NOT_DEMO', 'UNKNOWN_SYMBOL', 'NO_DATA'];
      throw new FeedError(known.find((k) => k === body.error) ?? 'BRIDGE_ERROR');
    }
    return body;
  };
  return {
    status: (symbol) => get<BridgeStatus>(`/status?symbol=${encodeURIComponent(symbol)}`),
    rates: async (symbol, count) =>
      (
        await get<{ bars: BrokerBar[] }>(
          `/rates?symbol=${encodeURIComponent(symbol)}&count=${count}`,
        )
      ).bars,
  };
}

export const INITIAL_MINUTES = 7 * 1440;
const MAX_BARS = 20_000;

export function mt5DatasetId(server: string, symbol: string): string {
  return `mt5:${server.replace(/[^A-Za-z0-9._-]/g, '_')}:${symbol}`;
}

export interface SyncResult {
  meta: DataSetMeta;
  added: number;
  revised: number;
  offsetMs: number;
  /** A DST change inside the new bars: older ones may carry a different server offset. */
  dstWarning: boolean;
}

/**
 * Pulls closed 1m bars from the bridge into the broker's own dataset (D39): measures the server
 * offset, converts to UTC, merges (revisions counted), validates and stores.
 */
export async function syncMt5Dataset(opts: {
  client: Mt5Client;
  repo: MarketRepo;
  /** Workstation instrument, e.g. EURUSD. */
  symbol: string;
  /** The broker's name for it when different (e.g. EURUSD.m). */
  brokerSymbol?: string;
  now: () => number;
}): Promise<SyncResult> {
  const { client, repo, symbol } = opts;
  const brokerSymbol = opts.brokerSymbol?.trim() || symbol;
  const inst = getInstrument(symbol);
  const st = await client.status(brokerSymbol);
  const offset = detectServerOffset(st.lastTickServerSec, st.utcNowMs, inst);
  if (!offset.ok) throw new FeedError(offset.reason);
  const id = mt5DatasetId(st.account.server, symbol);
  const existing = (await repo.listDatasets()).find((d) => d.id === id) ?? null;
  let rows: CandleRow[] = [];
  if (existing) {
    const s = await repo.loadSeries(id);
    rows = Array.from({ length: s.length }, (_, i) => ({
      t: s.t[i]!,
      o: s.o[i]!,
      h: s.h[i]!,
      l: s.l[i]!,
      c: s.c[i]!,
      ...(s.v ? { v: s.v[i]! } : {}),
    }));
  }
  const last = rows.at(-1)?.t;
  const minutes =
    last === undefined ? INITIAL_MINUTES : Math.ceil((st.utcNowMs - last) / 60_000) + 5;
  const bars = await client.rates(brokerSymbol, Math.max(1, Math.min(MAX_BARS, minutes)));
  if (bars.length === 0 && rows.length === 0) throw new FeedError('NO_DATA');
  const merged = mergeBrokerBars(rows, bars, offset.offsetMs);
  const series = seriesFromRows(merged.rows, true);
  const first = merged.rows[0]!;
  const lastRow = merged.rows.at(-1)!;
  const newTimes = bars.map((b) => b.t * 1000 - offset.offsetMs);
  const meta: DataSetMeta = {
    id,
    instrument: symbol,
    baseTimeframe: '1m',
    // MT5 forex bars are built from bid prices (assumption, D39).
    priceType: 'BID',
    source: {
      name: `MT5: ${st.account.server}`,
      fileName: 'MT5 köprüsü',
      sourceTimezone: 'UTC',
      mapping: {
        hasHeader: false,
        time: { kind: 'SINGLE', column: 0 },
        dateFormat: 'UNIX_MS',
        open: 1,
        high: 2,
        low: 3,
        close: 4,
        volume: 5,
      },
      importedAt: opts.now(),
    },
    range: { from: first.t, to: lastRow.t },
    candleCount: series.length,
    contentHash: series.contentHash,
    engineVersion: ENGINE_VERSION,
    validation: validateRecords(
      merged.rows.map((r, i) => ({ ...r, row: i })),
      inst,
      { timeframe: '1m' },
    ),
    parseErrors: [],
    dstIssues: [],
    acceptedIssues: [],
    demo: false,
  };
  await repo.saveDataset(meta, series);
  return {
    meta,
    added: merged.added,
    revised: merged.revised,
    offsetMs: offset.offsetMs,
    dstWarning:
      newTimes.length > 1 && offsetMayHaveChanged(Math.min(...newTimes), Math.max(...newTimes)),
  };
}
