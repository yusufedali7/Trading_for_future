import { tr } from '../../i18n/tr';
import type { Tool } from '../../chart/use-drawing-layer';

const TOOLS: Tool[] = [
  'SELECT',
  'HLINE',
  'TRENDLINE',
  'RECT',
  'PRICE_RANGE',
  'POSITION_LONG',
  'POSITION_SHORT',
];

export function DrawingTools({ tool, onTool }: { tool: Tool; onTool: (t: Tool) => void }) {
  return (
    <div className="drawing-tools">
      <div className="segmented segmented-vertical" role="group" aria-label={tr.drawings.tools}>
        {TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            className="seg seg-text"
            aria-pressed={tool === t}
            onClick={() => onTool(t)}
          >
            {tr.drawings.kinds[t]}
          </button>
        ))}
      </div>
      <span className="hint">{tr.drawings.hints[tool]}</span>
    </div>
  );
}
