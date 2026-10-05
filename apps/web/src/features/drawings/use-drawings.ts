import { useCallback, useEffect, useRef, useState } from 'react';
import type { Drawing, SupportResistanceLevel } from '@trw/engine';
import type { DrawingsRepo } from '../../storage/drawings-repo';

interface Snapshot {
  drawings: Drawing[];
  levels: SupportResistanceLevel[];
}

interface State extends Snapshot {
  instrument: string | null;
}

const HISTORY = 100;

const differs = <T>(a: T | undefined, b: T) => JSON.stringify(a) !== JSON.stringify(b);

/**
 * Drawings and levels of one instrument, kept in sync with the user-data store, with undo/redo.
 * Every change records the state before it; undo writes the difference back to the store
 * (deleting a drawing also deletes its level, so levels are restored after drawings).
 * Changes run one after another, so quick repeated actions (Ctrl+Z Ctrl+Z) never interleave.
 */
export function useDrawings(repo: DrawingsRepo, instrument: string | null, now: () => number) {
  const [state, setState] = useState<State>({ instrument: null, drawings: [], levels: [] });
  const stateRef = useRef(state);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const [, setVersion] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const commit = (next: State) => {
    stateRef.current = next;
    setState(next);
  };
  const run = (op: () => Promise<void>) => {
    queue.current = queue.current.then(op, op);
    return queue.current;
  };

  useEffect(() => {
    if (!instrument) return;
    let cancelled = false;
    void repo.list(instrument).then((r) => {
      if (cancelled) return;
      commit({ instrument, ...r });
      history.current = { past: [], future: [] };
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [repo, instrument]);

  const record = () => {
    const { drawings, levels } = stateRef.current;
    history.current = {
      past: [...history.current.past, { drawings, levels }].slice(-HISTORY),
      future: [],
    };
    setVersion((v) => v + 1);
  };

  const saveDrawing = useCallback(
    (d: Drawing, isNew = false) =>
      run(async () => {
        const saved = isNew ? d : { ...d, updatedAt: now() };
        record();
        await repo.saveDrawing(saved);
        const s = stateRef.current;
        commit({
          ...s,
          drawings: s.drawings.some((x) => x.id === saved.id)
            ? s.drawings.map((x) => (x.id === saved.id ? saved : x))
            : [...s.drawings, saved],
        });
      }),
    [repo, now],
  );

  const deleteDrawings = useCallback(
    (ids: readonly string[]) =>
      run(async () => {
        if (ids.length === 0) return;
        record();
        for (const id of ids) await repo.deleteDrawing(id);
        const gone = new Set(ids);
        const s = stateRef.current;
        commit({
          ...s,
          drawings: s.drawings.filter((d) => !gone.has(d.id)),
          levels: s.levels.filter((l) => !gone.has(l.drawingId)),
        });
      }),
    [repo],
  );
  const deleteDrawing = useCallback((id: string) => deleteDrawings([id]), [deleteDrawings]);

  const saveLevel = useCallback(
    (l: SupportResistanceLevel) =>
      run(async () => {
        record();
        await repo.saveLevel(l);
        const s = stateRef.current;
        commit({
          ...s,
          levels: s.levels.some((x) => x.id === l.id)
            ? s.levels.map((x) => (x.id === l.id ? l : x))
            : [...s.levels, l],
        });
      }),
    [repo],
  );

  const deleteLevel = useCallback(
    (id: string) =>
      run(async () => {
        record();
        await repo.deleteLevel(id);
        const s = stateRef.current;
        commit({ ...s, levels: s.levels.filter((l) => l.id !== id) });
      }),
    [repo],
  );

  /** Writes `target` to the store and state (only what differs from now). */
  const restore = async (target: Snapshot) => {
    const cur = stateRef.current;
    const want = new Map(target.drawings.map((d) => [d.id, d]));
    const have = new Map(cur.drawings.map((d) => [d.id, d]));
    for (const d of cur.drawings) if (!want.has(d.id)) await repo.deleteDrawing(d.id);
    for (const d of target.drawings) if (differs(have.get(d.id), d)) await repo.saveDrawing(d);
    const wantLevels = new Set(target.levels.map((l) => l.id));
    for (const l of cur.levels) if (!wantLevels.has(l.id)) await repo.deleteLevel(l.id);
    const haveLevels = new Map(cur.levels.map((l) => [l.id, l]));
    for (const l of target.levels) {
      // A deleted drawing took its level with it: write those back too.
      if (differs(haveLevels.get(l.id), l) || !have.has(l.drawingId)) await repo.saveLevel(l);
    }
    commit({ ...cur, drawings: target.drawings, levels: target.levels });
  };

  const undo = useCallback(
    () =>
      run(async () => {
        const { past, future } = history.current;
        const prev = past.at(-1);
        if (!prev) return;
        const { drawings, levels } = stateRef.current;
        history.current = { past: past.slice(0, -1), future: [{ drawings, levels }, ...future] };
        setVersion((v) => v + 1);
        await restore(prev);
      }),
    [repo],
  );

  const redo = useCallback(
    () =>
      run(async () => {
        const { past, future } = history.current;
        const next = future[0];
        if (!next) return;
        const { drawings, levels } = stateRef.current;
        history.current = { past: [...past, { drawings, levels }], future: future.slice(1) };
        setVersion((v) => v + 1);
        await restore(next);
      }),
    [repo],
  );

  const current = state.instrument === instrument;
  return {
    drawings: current ? state.drawings : [],
    levels: current ? state.levels : [],
    saveDrawing,
    deleteDrawing,
    deleteDrawings,
    saveLevel,
    deleteLevel,
    undo,
    redo,
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0,
  };
}
