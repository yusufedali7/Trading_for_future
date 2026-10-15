import { listInstruments } from '@trw/engine';

/**
 * research-note/v1 (D79/D80): imported from a JSON file the user generated with
 * `tools/research-notes` (a separate Python tool — see its design doc). Validated like a CSV
 * import (M1's "problems are reported, never silently fixed"): any field this allowlist doesn't
 * know about rejects the whole file, so a future decision/probability field added upstream can
 * never silently reach the UI (CLAUDE.md rules 6/9).
 */
export const NOTE_DISCLAIMER =
  'Bu bir AI yorum özetidir; al/sat tavsiyesi veya ölçülmüş bir olasılık değildir. Trading Research Workstation Kural 6/9.';

export interface ResearchNote {
  schema: 'research-note/v1';
  instrument: string;
  asOf: string;
  generatedAt: string;
  reports: {
    technical?: string;
    news?: string;
    sentiment?: string;
    fundamentals?: string;
  };
  debate: { rounds: { bull: string; bear: string }[] };
  modelInfo: { llmProvider: string; quickModel: string };
  usage?: { inputTokens: number; outputTokens: number };
  disclaimer: string;
}

export type NoteErrorCode =
  | 'NOT_JSON'
  | 'WRONG_SCHEMA'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'NO_REPORTS'
  | 'BAD_DISCLAIMER'
  | 'UNKNOWN_INSTRUMENT';

export class NoteError extends Error {
  constructor(
    readonly code: NoteErrorCode,
    readonly field?: string,
  ) {
    super(field ? `${code}: ${field}` : code);
  }
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const TOP_FIELDS = new Set([
  'schema',
  'instrument',
  'asOf',
  'generatedAt',
  'reports',
  'debate',
  'modelInfo',
  'usage',
  'disclaimer',
]);
const REPORT_FIELDS = new Set(['technical', 'news', 'sentiment', 'fundamentals']);
const MODEL_INFO_FIELDS = new Set(['llmProvider', 'quickModel']);
const USAGE_FIELDS = new Set(['inputTokens', 'outputTokens']);

function rejectUnknown(o: Record<string, unknown>, allowed: Set<string>, prefix: string): void {
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) throw new NoteError('UNKNOWN_FIELD', prefix ? `${prefix}.${k}` : k);
  }
}

function requireObj(data: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = data[key];
  if (!isObj(v)) throw new NoteError('MISSING_FIELD', key);
  return v;
}

/** Parses and validates a research-note/v1 JSON file; throws `NoteError` for any problem. */
export function parseResearchNote(text: string): ResearchNote {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new NoteError('NOT_JSON');
  }
  if (!isObj(data) || data.schema !== 'research-note/v1') throw new NoteError('WRONG_SCHEMA');
  rejectUnknown(data, TOP_FIELDS, '');

  for (const key of [
    'instrument',
    'asOf',
    'generatedAt',
    'reports',
    'debate',
    'modelInfo',
    'disclaimer',
  ]) {
    if (!(key in data)) throw new NoteError('MISSING_FIELD', key);
  }

  const instrument = data.instrument;
  if (typeof instrument !== 'string' || !listInstruments().some((i) => i.symbol === instrument)) {
    throw new NoteError('UNKNOWN_INSTRUMENT', String(instrument));
  }

  const reports = requireObj(data, 'reports');
  rejectUnknown(reports, REPORT_FIELDS, 'reports');
  if (Object.keys(reports).length === 0) throw new NoteError('NO_REPORTS');

  const modelInfo = requireObj(data, 'modelInfo');
  rejectUnknown(modelInfo, MODEL_INFO_FIELDS, 'modelInfo');

  if ('usage' in data) {
    rejectUnknown(requireObj(data, 'usage'), USAGE_FIELDS, 'usage');
  }

  const debate = requireObj(data, 'debate');
  if (!Array.isArray(debate.rounds)) throw new NoteError('MISSING_FIELD', 'debate.rounds');

  if (data.disclaimer !== NOTE_DISCLAIMER) throw new NoteError('BAD_DISCLAIMER');

  return data as unknown as ResearchNote;
}
