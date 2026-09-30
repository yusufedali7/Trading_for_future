import type { CsvMapping, Fix, IanaTz } from '@trw/engine';
import { handleImportRequest, type ImportRequest, type ImportResponse } from './protocol';
import { ImportSession, type AnalysisSummary, type FinishResult, type ReadResult } from './session';

/** Async facade over an ImportSession, either in a Web Worker or in-process (tests). */
export interface Importer {
  read(file: File): Promise<ReadResult>;
  analyze(mapping: CsvMapping, sourceTz: IanaTz, instrument: string): Promise<AnalysisSummary>;
  finish(accepted: Fix[]): Promise<FinishResult>;
  /** Cancels any running work and releases the worker. */
  dispose(): void;
}

type Pending = { resolve: (r: unknown) => void; reject: (e: Error) => void };
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function makeImporter(
  send: (req: ImportRequest) => void,
  onDispose: () => void,
): { importer: Importer; receive: (res: ImportResponse) => void } {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  const call = <T>(req: WithoutId<ImportRequest>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      send({ ...req, id } as ImportRequest);
    });
  const receive = (res: ImportResponse) => {
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (res.ok) p.resolve(res.result);
    else p.reject(new Error(res.error));
  };
  const importer: Importer = {
    read: (file) => call({ method: 'read', file }),
    analyze: (mapping, sourceTz, instrument) =>
      call({ method: 'analyze', mapping, sourceTz, instrument }),
    finish: (accepted) => call({ method: 'finish', accepted }),
    dispose: () => {
      onDispose();
      for (const p of pending.values()) p.reject(new Error('cancelled'));
      pending.clear();
    },
  };
  return { importer, receive };
}

export function createWorkerImporter(): Importer {
  const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
    type: 'module',
  });
  const { importer, receive } = makeImporter(
    (req) => worker.postMessage(req),
    () => worker.terminate(),
  );
  worker.onmessage = (e: MessageEvent<ImportResponse>) => receive(e.data);
  return importer;
}

export function createInProcessImporter(): Importer {
  const session = new ImportSession();
  let disposed = false;
  const { importer, receive } = makeImporter(
    (req) => {
      void handleImportRequest(session, req).then(({ response }) => {
        if (!disposed) receive(response);
      });
    },
    () => {
      disposed = true;
    },
  );
  return importer;
}
