import { specHash, validateSpec, type SpecProblem, type StrategySpec } from '../strategy/schema';

/** A spec path that a parameter sweep may vary, e.g. `target.r` or `steps.1.maxBars`. */
export type SweepParamId = string;

export interface SweepParam {
  id: SweepParamId;
  kind: 'int' | 'number';
  current: number;
}

/** Parameters of this spec that can be swept (only those its rules actually use). */
export function sweepableParams(spec: StrategySpec): SweepParam[] {
  const out: SweepParam[] = [];
  const add = (id: string, kind: SweepParam['kind'], current: number) =>
    out.push({ id, kind, current });
  if (spec.target.type === 'R_MULTIPLE') add('target.r', 'number', spec.target.r);
  if (spec.target.type === 'FIXED_PIPS') add('target.pips', 'number', spec.target.pips);
  if (spec.target.type === 'AT_REF') add('target.bufferPips', 'number', spec.target.bufferPips);
  if (spec.stop.type === 'BEYOND_REF') add('stop.bufferPips', 'number', spec.stop.bufferPips);
  else if (spec.stop.type === 'ATR_MULTIPLE') {
    add('stop.period', 'int', spec.stop.period);
    add('stop.mult', 'number', spec.stop.mult);
  } else add('stop.pips', 'number', spec.stop.pips);
  if (spec.entry.type !== 'MARKET') add('entry.expireBars', 'int', spec.entry.expireBars);
  spec.steps.forEach((st, i) => {
    if (i > 0 && st.maxBars !== undefined) add(`steps.${i}.maxBars`, 'int', st.maxBars);
  });
  add('features.swing.left', 'int', spec.features.swing.left);
  add('features.swing.right', 'int', spec.features.swing.right);
  add('features.fvg.minSizePips', 'number', spec.features.fvg.minSizePips);
  add('features.sweep.swingMaxAgeBars', 'int', spec.features.sweep.swingMaxAgeBars);
  return out;
}

/** A copy of the spec with one numeric parameter replaced. Unknown paths throw. */
export function applyParam(spec: StrategySpec, id: SweepParamId, value: number): StrategySpec {
  const copy = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  const path = id.split('.');
  let node: Record<string, unknown> = copy;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    if (next === null || typeof next !== 'object') throw new Error(`unknown parameter ${id}`);
    node = next as Record<string, unknown>;
  }
  const last = path[path.length - 1]!;
  if (typeof node[last] !== 'number') throw new Error(`unknown parameter ${id}`);
  node[last] = value;
  return copy as unknown as StrategySpec;
}

export interface SweepAxis {
  id: SweepParamId;
  values: number[];
}

export interface SweepVariant {
  /** Parameter values of this combination, in axis order. */
  values: Record<SweepParamId, number>;
  spec: StrategySpec;
  specHash: string;
  /** Not empty: the combination is invalid and is not run. */
  problems: SpecProblem[];
}

export const MAX_SWEEP_COMBINATIONS = 100;

/**
 * Every combination of one or two axes, first axis outer, values in the given order (duplicates
 * dropped). Deterministic, so a sweep's trials can be counted and repeated (D37).
 */
export function sweepGrid(spec: StrategySpec, axes: readonly SweepAxis[]): SweepVariant[] {
  if (axes.length < 1 || axes.length > 2) throw new Error('a sweep has one or two parameters');
  if (axes.length === 2 && axes[0]!.id === axes[1]!.id) throw new Error('two different parameters');
  const lists = axes.map((a) => [...new Set(a.values.filter((v) => Number.isFinite(v)))]);
  const total = lists.reduce((n, l) => n * l.length, 1);
  if (total === 0) return [];
  if (total > MAX_SWEEP_COMBINATIONS)
    throw new Error(`at most ${MAX_SWEEP_COMBINATIONS} combinations`);
  const combos: number[][] =
    lists.length === 1
      ? lists[0]!.map((v) => [v])
      : lists[0]!.flatMap((a) => lists[1]!.map((b) => [a, b]));
  return combos.map((vals) => {
    let s = spec;
    const values: Record<string, number> = {};
    vals.forEach((v, i) => {
      s = applyParam(s, axes[i]!.id, v);
      values[axes[i]!.id] = v;
    });
    return { values, spec: s, specHash: specHash(s), problems: validateSpec(s) };
  });
}
