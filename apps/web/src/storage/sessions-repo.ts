import type { SessionDefinition, UtcMs } from '@trw/engine';

/** A session the user defined (D35); the definition plus how it looks on the chart. */
export interface UserSession extends SessionDefinition {
  /** Box and toggle colour; never the only cue (boxes carry the name). */
  color: string;
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

export interface SessionsRepo {
  list(): Promise<UserSession[]>;
  save(s: UserSession): Promise<void>;
  delete(id: string): Promise<void>;
}

export const byCreatedSession = (a: UserSession, b: UserSession) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

/** The engine needs only the definition. */
export function toDefinition({
  color: _c,
  createdAt: _a,
  updatedAt: _u,
  ...d
}: UserSession): SessionDefinition {
  return d;
}

export function createMemorySessionsRepo(initial: UserSession[] = []): SessionsRepo {
  const map = new Map(initial.map((s) => [s.id, s]));
  return {
    list: async () => [...map.values()].sort(byCreatedSession),
    save: async (s) => {
      map.set(s.id, s);
    },
    delete: async (id) => {
      map.delete(id);
    },
  };
}
