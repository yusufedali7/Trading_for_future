import type { CsvMapping, Fix, IanaTz } from '@trw/engine';
import type { AnalysisSummary, FinishResult, ImportSession, ReadResult } from './session';

export type ImportRequest =
  | { id: number; method: 'read'; file: Blob & { name?: string } }
  | { id: number; method: 'analyze'; mapping: CsvMapping; sourceTz: IanaTz; instrument: string }
  | { id: number; method: 'finish'; accepted: Fix[] };

export type ImportResult = ReadResult | AnalysisSummary | FinishResult;

export type ImportResponse =
  { id: number; ok: true; result: ImportResult } | { id: number; ok: false; error: string };

/** Runs one request against the session. Errors become messages; the worker never dies on them. */
export async function handleImportRequest(
  session: ImportSession,
  req: ImportRequest,
): Promise<{ response: ImportResponse; transfer: Transferable[] }> {
  try {
    switch (req.method) {
      case 'read': {
        const text = await req.file.text();
        const result = session.read(text, req.file.name ?? 'dosya.csv');
        return { response: { id: req.id, ok: true, result }, transfer: [] };
      }
      case 'analyze': {
        const result = session.analyze(req.mapping, req.sourceTz, req.instrument);
        return { response: { id: req.id, ok: true, result }, transfer: [] };
      }
      case 'finish': {
        const result = session.finish(req.accepted);
        const s = result.series;
        const transfer = [s.t, s.o, s.h, s.l, s.c, ...(s.v ? [s.v] : [])].map((a) => a.buffer);
        return { response: { id: req.id, ok: true, result }, transfer };
      }
    }
  } catch (err) {
    return {
      response: { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) },
      transfer: [],
    };
  }
}
