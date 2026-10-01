import type { Drawing, Instrument, SupportResistanceLevel } from '@trw/engine';
import { levelTag } from '../../chart/drawing-labels';
import { tr } from '../../i18n/tr';

function priceText(d: Drawing | undefined, inst: Instrument): string {
  if (!d) return '—';
  const f = (x: number) => x.toFixed(inst.pricePrecision);
  if (d.kind === 'HLINE') return f(d.anchors[0]!.p);
  const [a, b] = [d.anchors[0]!.p, d.anchors[1]!.p];
  return `${f(Math.min(a, b))} – ${f(Math.max(a, b))}`;
}

export function LevelsPanel(p: {
  levels: readonly SupportResistanceLevel[];
  drawings: readonly Drawing[];
  instrument: Instrument;
  selectedId: string | null;
  onSelect: (drawingId: string) => void;
}) {
  const byId = new Map(p.drawings.map((d) => [d.id, d]));
  return (
    <section className="panel" aria-labelledby="levels-title">
      <h3 id="levels-title">{tr.levels.title}</h3>
      {p.levels.length === 0 ? (
        <p className="hint">{tr.levels.empty}</p>
      ) : (
        <ul className="levels" aria-labelledby="levels-title">
          {p.levels.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="level-row"
                aria-pressed={p.selectedId === l.drawingId}
                onClick={() => p.onSelect(l.drawingId)}
              >
                <span className="mono">{priceText(byId.get(l.drawingId), p.instrument)}</span>
                <span>{levelTag(l)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
