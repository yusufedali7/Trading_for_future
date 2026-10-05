import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketRepo } from '../../storage/market-repo';
import type { PaperFeedPrefs } from '../../storage/db-user';
import {
  FeedError,
  syncMt5Dataset,
  type FeedProblem,
  type Mt5Client,
  type SyncResult,
} from './mt5-feed';

export const AUTO_MS = 60_000;

export interface Mt5Feed {
  config: PaperFeedPrefs;
  setConfig: (patch: Partial<PaperFeedPrefs>) => void;
  syncing: boolean;
  problem: FeedProblem | null;
  last: SyncResult | null;
  sync: () => Promise<void>;
}

/**
 * Lives in the app shell, not in the Paper page, so the minute-by-minute update keeps running
 * while another view is open; `config` comes from the saved preferences.
 */
export function useMt5Feed(p: {
  client: Mt5Client;
  repo: MarketRepo;
  now: () => number;
  config: PaperFeedPrefs | null;
  onConfig: (next: PaperFeedPrefs) => void;
  onSynced: () => Promise<void>;
}): Mt5Feed | null {
  const [syncing, setSyncing] = useState(false);
  const [problem, setProblem] = useState<FeedProblem | null>(null);
  const [last, setLast] = useState<SyncResult | null>(null);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (!p.config || busy.current) return;
    busy.current = true;
    setSyncing(true);
    setProblem(null);
    try {
      const res = await syncMt5Dataset({
        client: p.client,
        repo: p.repo,
        symbol: p.config.instrument,
        brokerSymbol: p.config.brokerSymbol,
        now: p.now,
      });
      setLast(res);
      await p.onSynced();
    } catch (e) {
      setProblem(e instanceof FeedError ? e.problem : 'BRIDGE_ERROR');
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [p.client, p.repo, p.now, p.onSynced, p.config?.instrument, p.config?.brokerSymbol]);

  const syncRef = useRef(sync);
  syncRef.current = sync;
  const auto = p.config?.auto ?? false;
  useEffect(() => {
    if (!auto) return;
    void syncRef.current();
    const id = setInterval(() => void syncRef.current(), AUTO_MS);
    return () => clearInterval(id);
  }, [auto]);

  if (!p.config) return null;
  const config = p.config;
  return {
    config,
    setConfig: (patch) => p.onConfig({ ...config, ...patch }),
    syncing,
    problem,
    last,
    sync,
  };
}
