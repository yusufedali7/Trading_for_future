/// <reference lib="webworker" />
import {
  createInProcessCandleSource,
  handleCandleRequest,
  type CandleRequest,
} from '../compute/candle-source';
import { createDexieMarketRepo } from '../storage/db-market';

const source = createInProcessCandleSource(createDexieMarketRepo());

self.onmessage = async (e: MessageEvent<CandleRequest>) => {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(
    await handleCandleRequest(source, e.data),
  );
};
