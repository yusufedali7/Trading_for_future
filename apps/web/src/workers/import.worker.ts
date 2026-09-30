/// <reference lib="webworker" />
import { ImportSession } from '../import/session';
import { handleImportRequest, type ImportRequest } from '../import/protocol';

const session = new ImportSession();

self.onmessage = async (e: MessageEvent<ImportRequest>) => {
  const { response, transfer } = await handleImportRequest(session, e.data);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(response, transfer);
};
