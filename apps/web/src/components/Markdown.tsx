import type { ReactNode } from 'react';

/**
 * A deliberately tiny markdown subset for the static education texts (glossary, lessons):
 * paragraphs, "- " lists, **bold**, *italic*, `code`. Everything becomes React elements, so raw
 * HTML in the text is shown as text, never interpreted.
 */
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = out.length;
    if (m[1] !== undefined) out.push(<strong key={key}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={key}>{m[2]}</em>);
    else out.push(<code key={key}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul'; items: string[] };

export function Markdown({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const top = blocks[blocks.length - 1];
    if (line === '') {
      blocks.push({ kind: 'p', lines: [] });
    } else if (line.startsWith('- ')) {
      if (top?.kind === 'ul') top.items.push(line.slice(2));
      else blocks.push({ kind: 'ul', items: [line.slice(2)] });
    } else if (top?.kind === 'p') {
      top.lines.push(line);
    } else {
      blocks.push({ kind: 'p', lines: [line] });
    }
  }
  return (
    <div className="md">
      {blocks.map((b, i) =>
        b.kind === 'ul' ? (
          <ul key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : b.lines.length > 0 ? (
          <p key={i}>{inline(b.lines.join(' '))}</p>
        ) : null,
      )}
    </div>
  );
}
