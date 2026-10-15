import { describe, expect, it } from 'vitest';
import {
  NOTE_DISCLAIMER,
  NoteError,
  parseResearchNote,
} from '../src/features/research-notes/parse';

// SYNTHETIC: a valid research-note/v1, shaped exactly like trw_notes.note.to_research_note's
// output (D79 Görev 2).
function validNote(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'research-note/v1',
    instrument: 'EURUSD',
    asOf: '2026-10-14',
    generatedAt: '2026-10-14T09:12:00Z',
    reports: { technical: 'teknik rapor', news: 'haber raporu' },
    debate: { rounds: [{ bull: 'alim gorusu', bear: 'satim gorusu' }] },
    modelInfo: { llmProvider: 'anthropic', quickModel: 'claude-haiku-4-5' },
    disclaimer: NOTE_DISCLAIMER,
    ...overrides,
  };
}

const errorOf = (fn: () => unknown): NoteError => {
  try {
    fn();
  } catch (e) {
    if (e instanceof NoteError) return e;
    throw e;
  }
  throw new Error('expected parseResearchNote to throw');
};

describe('parseResearchNote', () => {
  it('accepts a valid note, usage included', () => {
    const note = parseResearchNote(
      JSON.stringify(validNote({ usage: { inputTokens: 120, outputTokens: 40 } })),
    );
    expect(note.instrument).toBe('EURUSD');
    expect(note.reports).toEqual({ technical: 'teknik rapor', news: 'haber raporu' });
    expect(note.usage).toEqual({ inputTokens: 120, outputTokens: 40 });
  });

  it('accepts a valid note without usage', () => {
    const note = parseResearchNote(JSON.stringify(validNote()));
    expect(note.usage).toBeUndefined();
  });

  it('rejects text that is not JSON', () => {
    expect(errorOf(() => parseResearchNote('{not json')).code).toBe('NOT_JSON');
  });

  it('rejects the wrong schema', () => {
    const err = errorOf(() => parseResearchNote(JSON.stringify(validNote({ schema: 'other/v1' }))));
    expect(err.code).toBe('WRONG_SCHEMA');
  });

  it('rejects an unknown top-level field, naming it', () => {
    const err = errorOf(() => parseResearchNote(JSON.stringify(validNote({ decision: 'BUY' }))));
    expect(err.code).toBe('UNKNOWN_FIELD');
    expect(err.field).toBe('decision');
  });

  it('rejects an unknown field inside reports, naming its path', () => {
    const note = validNote();
    (note.reports as Record<string, unknown>).rating = 'Strong Buy';
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('UNKNOWN_FIELD');
    expect(err.field).toBe('reports.rating');
  });

  it('rejects an unknown field inside modelInfo, naming its path', () => {
    const note = validNote();
    (note.modelInfo as Record<string, unknown>).deepThinkModel = 'claude-opus-5';
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('UNKNOWN_FIELD');
    expect(err.field).toBe('modelInfo.deepThinkModel');
  });

  it('rejects an unknown field inside usage, naming its path', () => {
    const note = validNote({ usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.01 } });
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('UNKNOWN_FIELD');
    expect(err.field).toBe('usage.costUsd');
  });

  it('rejects empty reports', () => {
    const err = errorOf(() => parseResearchNote(JSON.stringify(validNote({ reports: {} }))));
    expect(err.code).toBe('NO_REPORTS');
  });

  it('rejects a changed disclaimer', () => {
    const err = errorOf(() =>
      parseResearchNote(JSON.stringify(validNote({ disclaimer: 'Al şimdi!' }))),
    );
    expect(err.code).toBe('BAD_DISCLAIMER');
  });

  it('rejects an instrument not in the registry', () => {
    const err = errorOf(() =>
      parseResearchNote(JSON.stringify(validNote({ instrument: 'DOGEUSD' }))),
    );
    expect(err.code).toBe('UNKNOWN_INSTRUMENT');
    expect(err.field).toBe('DOGEUSD');
  });

  it('rejects an unknown field inside debate, naming its path', () => {
    const note = validNote();
    (note.debate as Record<string, unknown>).judge_decision = 'BUY';
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('UNKNOWN_FIELD');
    expect(err.field).toBe('debate.judge_decision');
  });

  it('rejects an unknown field inside a debate round, naming its path', () => {
    const note = validNote();
    (note.debate as { rounds: Record<string, unknown>[] }).rounds[0]!.decision = 'BUY';
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('UNKNOWN_FIELD');
    expect(err.field).toBe('debate.rounds[0].decision');
  });

  it('rejects a non-string report value instead of crashing the panel later', () => {
    const err = errorOf(() =>
      parseResearchNote(JSON.stringify(validNote({ reports: { technical: 42 } }))),
    );
    expect(err.code).toBe('BAD_TYPE');
    expect(err.field).toBe('reports.technical');
  });

  it('rejects a non-string asOf (would break the newest-first sort and backups)', () => {
    const err = errorOf(() => parseResearchNote(JSON.stringify(validNote({ asOf: 20261014 }))));
    expect(err.code).toBe('BAD_TYPE');
    expect(err.field).toBe('asOf');
  });

  it('rejects a null debate round', () => {
    const note = validNote({ debate: { rounds: [null] } });
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('BAD_TYPE');
    expect(err.field).toBe('debate.rounds[0]');
  });

  it('rejects a non-string bull/bear turn', () => {
    const note = validNote({ debate: { rounds: [{ bull: 1, bear: 'satim gorusu' }] } });
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('BAD_TYPE');
    expect(err.field).toBe('debate.rounds[0].bull');
  });

  it('rejects a non-number usage token count', () => {
    const note = validNote({ usage: { inputTokens: '120', outputTokens: 40 } });
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('BAD_TYPE');
    expect(err.field).toBe('usage.inputTokens');
  });

  it('rejects a non-string modelInfo field', () => {
    const note = validNote({ modelInfo: { llmProvider: 'anthropic', quickModel: null } });
    const err = errorOf(() => parseResearchNote(JSON.stringify(note)));
    expect(err.code).toBe('BAD_TYPE');
    expect(err.field).toBe('modelInfo.quickModel');
  });
});
