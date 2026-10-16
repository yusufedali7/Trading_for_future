import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { getInstrument, type DataSetMeta, type HarmonicPattern } from '@trw/engine';
import { ConceptsPage } from '../src/features/concepts/ConceptsPage';

const T0 = Date.parse('2026-01-06T08:00:00Z');

// SYNTHETIC: a single harmonic candidate, shape doesn't matter here (only patternId/direction/
// formedAt do - this test is about ConceptsPage wiring the example's layer through, not
// detection itself, which is already covered by packages/engine's harmonic tests).
function fakeGartley(): HarmonicPattern {
  return {
    id: 'h1',
    patternId: 'gartley',
    ratioSetSource: 'test',
    defVersion: 'v1',
    direction: 'BULLISH',
    pivots: [],
    formedAt: T0,
    formedIndex: 0,
    confirmedAt: T0 + 60_000,
    confirmedIndex: 1,
    ratios: {},
  };
}

const meta = { instrument: 'EURUSD', source: { name: 'SYNTHETIC' } } as unknown as DataSetMeta;

describe('ConceptsPage - harmonic "Grafikte göster" (final-review finding, D83)', () => {
  it("passes the concept's own layer through onShow, not just the time", () => {
    const onShow = vi.fn();
    render(
      <ConceptsPage
        data={{
          candles: [],
          features: { swings: [], fvgs: [], breaks: [], sweeps: [], periods: [] },
          sessions: [],
          smc: {
            displacements: [],
            orderBlocks: [],
            ifvgs: [],
            breakers: [],
            equalLevels: [],
            premiumDiscount: [],
            ote: [],
            candidateSr: [],
            cisds: [],
          },
          harmonics: [fakeGartley()],
        }}
        meta={meta}
        instrument={getInstrument('EURUSD')}
        timeframe="15m"
        displayTz="UTC"
        sessionNames={{}}
        canShow={true}
        onShow={onShow}
        focus="GARTLEY"
      />,
    );

    const card = within(screen.getByRole('article', { name: 'Gartley' }));
    fireEvent.click(
      within(card.getByRole('group', { name: 'Örnekler' })).getByRole('button', {
        name: 'Grafikte göster',
      }),
    );

    expect(onShow).toHaveBeenCalledWith({ at: T0, layer: 'GARTLEY' });
  });
});
