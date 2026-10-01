import { useCallback, useEffect, useState } from 'react';
import type { Drawing, SupportResistanceLevel } from '@trw/engine';
import type { DrawingsRepo } from '../../storage/drawings-repo';

interface State {
  instrument: string | null;
  drawings: Drawing[];
  levels: SupportResistanceLevel[];
}

/** Drawings and levels of one instrument, kept in sync with the user-data store. */
export function useDrawings(repo: DrawingsRepo, instrument: string | null, now: () => number) {
  const [state, setState] = useState<State>({ instrument: null, drawings: [], levels: [] });

  useEffect(() => {
    if (!instrument) return;
    let cancelled = false;
    void repo.list(instrument).then((r) => {
      if (!cancelled) setState({ instrument, ...r });
    });
    return () => {
      cancelled = true;
    };
  }, [repo, instrument]);

  const saveDrawing = useCallback(
    async (d: Drawing, isNew = false) => {
      const saved = isNew ? d : { ...d, updatedAt: now() };
      await repo.saveDrawing(saved);
      setState((s) => ({
        ...s,
        drawings: s.drawings.some((x) => x.id === saved.id)
          ? s.drawings.map((x) => (x.id === saved.id ? saved : x))
          : [...s.drawings, saved],
      }));
    },
    [repo, now],
  );

  const deleteDrawing = useCallback(
    async (id: string) => {
      await repo.deleteDrawing(id);
      setState((s) => ({
        ...s,
        drawings: s.drawings.filter((d) => d.id !== id),
        levels: s.levels.filter((l) => l.drawingId !== id),
      }));
    },
    [repo],
  );

  const saveLevel = useCallback(
    async (l: SupportResistanceLevel) => {
      await repo.saveLevel(l);
      setState((s) => ({
        ...s,
        levels: s.levels.some((x) => x.id === l.id)
          ? s.levels.map((x) => (x.id === l.id ? l : x))
          : [...s.levels, l],
      }));
    },
    [repo],
  );

  const deleteLevel = useCallback(
    async (id: string) => {
      await repo.deleteLevel(id);
      setState((s) => ({ ...s, levels: s.levels.filter((l) => l.id !== id) }));
    },
    [repo],
  );

  const current = state.instrument === instrument;
  return {
    drawings: current ? state.drawings : [],
    levels: current ? state.levels : [],
    saveDrawing,
    deleteDrawing,
    saveLevel,
    deleteLevel,
  };
}
