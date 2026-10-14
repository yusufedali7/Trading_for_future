import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { glossaryById } from '../content/glossary';
import { tr } from '../i18n/tr';
import { Markdown } from './Markdown';

const t = tr.learn.term;
const POP_WIDTH = 340;

/** Provided by the app: jumps to the glossary page with the given entry selected. */
export const GlossaryNav = createContext<((id: string) => void) | null>(null);

/**
 * A term with contextual help: click it to read its glossary entry in place. The popover is
 * portalled to <body> so the entry's paragraphs/lists stay valid HTML wherever the term sits.
 */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = glossaryById(id);
  const openGlossary = useContext(GlossaryNav);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const open = pos !== null;
  const popRef = useRef<HTMLDivElement>(null);
  // The popover is fixed-position: close it when anything scrolls instead of letting it drift.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return;
      setPos(null);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);
  if (!entry) return <>{children}</>;
  const close = () => setPos(null);
  return (
    <>
      <button
        type="button"
        className="term-link"
        aria-expanded={open}
        onClick={(e) => {
          if (pos) return close();
          const r = e.currentTarget.getBoundingClientRect();
          const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_WIDTH - 8));
          // Open upwards when the term sits in the lower half, so the popover stays on screen.
          setPos(
            r.bottom > window.innerHeight / 2
              ? { bottom: window.innerHeight - r.top + 4, left }
              : { top: r.bottom + 4, left },
          );
        }}
      >
        {children}
      </button>
      {pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={entry.term}
            className="term-pop panel stack"
            style={{ ...pos, width: POP_WIDTH }}
            onKeyDown={(e) => e.key === 'Escape' && close()}
          >
            <strong>{entry.term}</strong>
            <Markdown text={entry.body} />
            {entry.inApp && (
              <p className="hint">
                {t.inApp} {entry.inApp}
              </p>
            )}
            <div className="field-row">
              {openGlossary && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    openGlossary(entry.id);
                  }}
                >
                  {t.openGlossary}
                </button>
              )}
              <button type="button" onClick={close}>
                {t.close}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
