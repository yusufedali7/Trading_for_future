import { validateDrawing, type Drawing, type SupportResistanceLevel } from '@trw/engine';

/** User drawings and support/resistance levels ("trw-user" domain), keyed by instrument. */
export interface DrawingsRepo {
  list(instrument: string): Promise<{ drawings: Drawing[]; levels: SupportResistanceLevel[] }>;
  /** Insert or replace by id. Rejects drawings that fail validation. */
  saveDrawing(d: Drawing): Promise<void>;
  /** Deletes the drawing and every level linked to it. */
  deleteDrawing(id: string): Promise<void>;
  saveLevel(l: SupportResistanceLevel): Promise<void>;
  deleteLevel(id: string): Promise<void>;
}

export function assertValidDrawing(d: Drawing): void {
  const problems = validateDrawing(d);
  if (problems.length > 0) throw new Error(`Invalid drawing ${d.id}: ${problems.join(', ')}`);
}

const byCreated = <T extends { createdAt: number; id: string }>(a: T, b: T) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

export function createMemoryDrawingsRepo(): DrawingsRepo {
  const drawings = new Map<string, Drawing>();
  const levels = new Map<string, SupportResistanceLevel>();
  return {
    list: async (instrument) => ({
      drawings: [...drawings.values()].filter((d) => d.instrument === instrument).sort(byCreated),
      levels: [...levels.values()].filter((l) => l.instrument === instrument).sort(byCreated),
    }),
    saveDrawing: async (d) => {
      assertValidDrawing(d);
      drawings.set(d.id, d);
    },
    deleteDrawing: async (id) => {
      drawings.delete(id);
      for (const l of [...levels.values()]) if (l.drawingId === id) levels.delete(l.id);
    },
    saveLevel: async (l) => {
      levels.set(l.id, l);
    },
    deleteLevel: async (id) => {
      levels.delete(id);
    },
  };
}

export { byCreated };
