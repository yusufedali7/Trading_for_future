import { describe, expect, it } from 'vitest';
import { CATALOG_STRATEGIES } from '../src/catalog/strategies';
import { toBars } from '../src/features/bars';
import { computeFeatures } from '../src/features/compute';
import { computeSmc } from '../src/features/smc';
import { allSessionDefs } from '../src/session/sessions';
import { sessionLevels } from '../src/session/levels';
import { sessionInstances } from '../src/session/sessions';
import { findSetups } from '../src/strategy/matcher';
import { validateSpec } from '../src/strategy/schema';
import { EUR, MIN, syntheticMinutes } from './helpers/synthetic-minutes';
import { seriesFromRows } from '../src/data/columnar';
import { resample } from '../src/data/resample';

describe('CATALOG_STRATEGIES (D61)', () => {
  it('both london_asia_sweep versions are valid specs', () => {
    const specs = CATALOG_STRATEGIES.filter((c) => c.catalogId === 'london_asia_sweep');
    expect(specs).toHaveLength(2);
    expect(specs.map((c) => c.versionLabel)).toEqual(['fvg', 'order_block']);
    for (const c of specs) expect(validateSpec(c.spec)).toEqual([]);
  });

  it('both versions chain real sweep/break/FVG/order-block candidates end to end', () => {
    // The real spec's London 08-11 window + Asia-sweep requirement is rare by design (the
    // project's own real-data run found only 3 matches over ~14 months, D34) - too rare to
    // assert ">0" on a short synthetic walk without flaking. This drops the window and widens
    // maxBars to prove the chain itself works (SMC steps included), not to approximate frequency.
    const rows = syntheticMinutes('2026-01-05T00:00:00Z', '2026-04-05T00:00:00Z', 23, 6);
    const series = seriesFromRows(rows, false);
    const asOf = series.t[series.length - 1]! + MIN;
    const candles = resample(series, EUR, '15m', { asOf });
    const defs = allSessionDefs([]);
    const instances = defs.flatMap((def) => sessionInstances(def, EUR, series.t[0]!, asOf));
    const sessions = sessionLevels(series, instances, asOf, MIN);
    const b = toBars(candles, EUR, '15m');

    for (const c of CATALOG_STRATEGIES.filter((c) => c.catalogId === 'london_asia_sweep')) {
      const features = computeFeatures(
        { candles, inst: EUR, tf: '15m', periods: [], sessions, sessionDefs: defs },
        c.spec.features,
      );
      const smc = computeSmc(b, EUR);
      const relaxed = {
        ...c.spec,
        window: null,
        steps: c.spec.steps.map((s) => (s.id === 'sweep' ? s : { ...s, maxBars: 200 })),
      };
      const setups = findSetups(relaxed, b, features, smc);
      expect(setups.length).toBeGreaterThan(0);
    }
  });
});
