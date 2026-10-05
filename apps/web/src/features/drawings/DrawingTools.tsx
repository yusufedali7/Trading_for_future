import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Tool } from '../../chart/use-drawing-layer';
import { tr } from '../../i18n/tr';

const t = tr.drawings;

type GroupId = keyof typeof t.groups;

/** Same grouping as TradingView's left toolbar (only the tools we have). */
export const TOOL_GROUPS: readonly { id: GroupId; tools: readonly Tool[] }[] = [
  { id: 'CURSOR', tools: ['SELECT', 'ERASER'] },
  {
    id: 'LINES',
    tools: ['TRENDLINE', 'RAY', 'EXTENDED_LINE', 'HLINE', 'HRAY', 'VLINE', 'CROSSLINE', 'CHANNEL'],
  },
  { id: 'FIB', tools: ['FIB_RETRACEMENT', 'FIB_EXTENSION'] },
  { id: 'SHAPES', tools: ['RECT', 'ELLIPSE', 'ARROW'] },
  { id: 'NOTES', tools: ['TEXT', 'ARROW_UP', 'ARROW_DOWN'] },
  {
    id: 'MEASURE',
    tools: ['POSITION_LONG', 'POSITION_SHORT', 'PRICE_RANGE', 'DATE_RANGE', 'DATE_PRICE_RANGE'],
  },
];

const svg = (children: ReactNode) => (
  <svg
    viewBox="0 0 20 20"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="1.6" fill="currentColor" />;

const ICONS: Record<
  Tool | 'MAGNET' | 'KEEP' | 'LOCK' | 'EYE' | 'TRASH' | 'UNDO' | 'REDO',
  ReactNode
> = {
  SELECT: svg(<path d="M6 3l9 7-4 1 2.5 5-2 1-2.5-5L6 15z" />),
  ERASER: svg(
    <>
      <path d="M4 13l7-8 5 4-7 8H6z" />
      <path d="M8 17h8" />
    </>,
  ),
  TRENDLINE: svg(
    <>
      <path d="M4 16L16 4" />
      {dot(4, 16)}
      {dot(16, 4)}
    </>,
  ),
  RAY: svg(
    <>
      <path d="M4 16L18 2" />
      {dot(4, 16)}
      {dot(10, 10)}
    </>,
  ),
  EXTENDED_LINE: svg(
    <>
      <path d="M1 19L19 1" />
      {dot(7, 13)}
      {dot(13, 7)}
    </>,
  ),
  HLINE: svg(
    <>
      <path d="M1 10h18" />
      {dot(10, 10)}
    </>,
  ),
  HRAY: svg(
    <>
      <path d="M6 10h13" />
      {dot(6, 10)}
    </>,
  ),
  VLINE: svg(
    <>
      <path d="M10 1v18" />
      {dot(10, 10)}
    </>,
  ),
  CROSSLINE: svg(
    <>
      <path d="M10 1v18M1 10h18" />
      {dot(10, 10)}
    </>,
  ),
  CHANNEL: svg(
    <>
      <path d="M2 13L13 2M7 18L18 7" />
      <path d="M4.5 15.5l11-11" strokeDasharray="2 2" />
    </>,
  ),
  FIB_RETRACEMENT: svg(<path d="M2 4h16M2 8h16M2 11h16M2 16h16" />),
  FIB_EXTENSION: svg(
    <>
      <path d="M8 3h10M8 7h10M8 11h10" />
      <path d="M2 17l3-8 3 4" />
    </>,
  ),
  RECT: svg(<rect x="3" y="5" width="14" height="10" />),
  ELLIPSE: svg(<ellipse cx="10" cy="10" rx="7.5" ry="5" />),
  ARROW: svg(<path d="M4 16L15 5M9 5h6v6" />),
  TEXT: svg(<path d="M4 5V3h12v2M10 3v14M7 17h6" />),
  ARROW_UP: svg(<path d="M10 3l5 6h-3v8H8V9H5z" />),
  ARROW_DOWN: svg(<path d="M10 17l5-6h-3V3H8v8H5z" />),
  POSITION_LONG: svg(
    <>
      <rect x="3" y="3" width="14" height="7" />
      <rect x="3" y="10" width="14" height="5" strokeDasharray="2 2" />
    </>,
  ),
  POSITION_SHORT: svg(
    <>
      <rect x="3" y="5" width="14" height="5" strokeDasharray="2 2" />
      <rect x="3" y="10" width="14" height="7" />
    </>,
  ),
  PRICE_RANGE: svg(<path d="M10 2v16M6 6l4-4 4 4M6 14l4 4 4-4M4 2h12M4 18h12" />),
  DATE_RANGE: svg(<path d="M2 10h16M6 6l-4 4 4 4M14 6l4 4-4 4M2 4v12M18 4v12" />),
  DATE_PRICE_RANGE: svg(
    <>
      <rect x="3" y="3" width="14" height="14" strokeDasharray="2 2" />
      <path d="M10 5v10M5 10h10" />
    </>,
  ),
  MAGNET: svg(<path d="M5 3v7a5 5 0 0 0 10 0V3h-3v7a2 2 0 0 1-4 0V3zM5 6h3M12 6h3" />),
  KEEP: svg(
    <>
      <path d="M4 16L16 4" />
      <path d="M13 15h5M15.5 12.5v5" />
    </>,
  ),
  LOCK: svg(
    <>
      <rect x="4" y="9" width="12" height="9" rx="1" />
      <path d="M7 9V6a3 3 0 0 1 6 0v3" />
    </>,
  ),
  EYE: svg(
    <>
      <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </>,
  ),
  TRASH: svg(<path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12M8.5 8v6M11.5 8v6" />),
  UNDO: svg(<path d="M7 4L3 8l4 4M3 8h9a5 5 0 0 1 0 10H8" />),
  REDO: svg(<path d="M13 4l4 4-4 4M17 8H8a5 5 0 0 0 0 10h4" />),
};

export interface DrawingToolsProps {
  tool: Tool;
  onTool: (t: Tool) => void;
  magnet: boolean;
  onMagnet: () => void;
  keep: boolean;
  onKeep: () => void;
  lockAll: boolean;
  onLockAll: () => void;
  hideAll: boolean;
  onHideAll: () => void;
  count: number;
  onRemoveAll: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
}

/** TradingView-style left toolbar: one button per group showing its last tool, plus a list. */
export function DrawingTools(p: DrawingToolsProps) {
  const [last, setLast] = useState<Record<GroupId, Tool>>(
    () => Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, g.tools[0]!])) as Record<GroupId, Tool>,
  );
  const [open, setOpen] = useState<GroupId | null>(null);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // A tool chosen elsewhere (e.g. Escape → Seç) becomes its group's shown tool.
  useEffect(() => {
    const g = TOOL_GROUPS.find((x) => x.tools.includes(p.tool));
    if (g) setLast((l) => (l[g.id] === p.tool ? l : { ...l, [g.id]: p.tool }));
  }, [p.tool]);

  useEffect(() => {
    if (!open && !confirming) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(null);
        setConfirming(false);
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open, confirming]);

  const pick = (g: GroupId, tool: Tool) => {
    setLast((l) => ({ ...l, [g]: tool }));
    setOpen(null);
    p.onTool(tool);
  };

  const util = (
    icon: keyof typeof ICONS,
    label: string,
    onClick: () => void,
    pressed?: boolean,
    disabled = false,
  ) => (
    <button
      type="button"
      className="rail-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {ICONS[icon]}
    </button>
  );

  return (
    <div className="drawing-tools" ref={ref}>
      <div className="rail-group" role="group" aria-label={t.tools}>
        {TOOL_GROUPS.map((g) => {
          const shown = last[g.id];
          const groupName = t.groups[g.id];
          return (
            <div key={g.id} className="rail-item">
              <button
                type="button"
                className="rail-btn"
                aria-label={t.kinds[shown]}
                title={`${t.kinds[shown]} · ${groupName}`}
                aria-pressed={p.tool === shown}
                onClick={() => pick(g.id, shown)}
              >
                {ICONS[shown]}
              </button>
              {g.tools.length > 1 && (
                <button
                  type="button"
                  className="rail-more"
                  aria-label={t.moreTools(groupName)}
                  aria-expanded={open === g.id}
                  onClick={() => setOpen(open === g.id ? null : g.id)}
                >
                  ›
                </button>
              )}
              {open === g.id && (
                <div className="rail-flyout" role="group" aria-label={groupName}>
                  <div className="rail-flyout-title">{groupName}</div>
                  {g.tools.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      className="rail-flyout-item"
                      aria-pressed={p.tool === tool}
                      onClick={() => pick(g.id, tool)}
                    >
                      {ICONS[tool]}
                      <span>{t.kinds[tool]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="rail-group rail-utils">
        {util('MAGNET', t.utils.magnet, p.onMagnet, p.magnet)}
        {util('KEEP', t.utils.keep, p.onKeep, p.keep)}
        {util('LOCK', p.lockAll ? t.utils.unlockAll : t.utils.lockAll, p.onLockAll, p.lockAll)}
        {util('EYE', p.hideAll ? t.utils.showAll : t.utils.hideAll, p.onHideAll, p.hideAll)}
        <div className="rail-item">
          {util('TRASH', t.utils.removeAll, () => setConfirming(true), undefined, p.count === 0)}
          {confirming && (
            <div className="rail-flyout" role="alertdialog" aria-label={t.utils.removeAll}>
              <p>{t.utils.confirmRemoveAll(p.count)}</p>
              <div className="field-row">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setConfirming(false);
                    p.onRemoveAll();
                  }}
                >
                  {tr.journalPage.confirmYes}
                </button>
                <button type="button" className="btn" onClick={() => setConfirming(false)}>
                  {tr.journalPage.confirmNo}
                </button>
              </div>
            </div>
          )}
        </div>
        {util('UNDO', t.utils.undo, p.onUndo, undefined, !p.canUndo)}
        {util('REDO', t.utils.redo, p.onRedo, undefined, !p.canRedo)}
      </div>
    </div>
  );
}
