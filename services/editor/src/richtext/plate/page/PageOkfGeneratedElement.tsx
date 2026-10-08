// "Page look" generated okf block (<!-- okf:index --> ... <!-- /okf:index -->): rendered like the page
// shows it (headings, bullet lists, links) but read-only, with a small badge. It is regenerated on save,
// and written back byte for byte (the node keeps `raw`).
import { useMemo, type ReactNode } from 'react';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Nodes, RootContent } from 'mdast';

const parser = unified().use(remarkParse).use(remarkGfm);

/** The Markdown between the markers. */
export function okfInnerMarkdown(raw: string): string {
  return raw.replace(/^\s*<!--[^>]*-->\s*\n?/, '').replace(/\n?\s*<!--[^>]*-->\s*$/, '');
}

function render(node: Nodes, key: number | string): ReactNode {
  const kids = (n: { children: RootContent[] }) => n.children.map((c, i) => render(c, i));
  switch (node.type) {
    case 'root': return <>{kids(node)}</>;
    case 'heading': { const H = `h${node.depth}` as 'h2'; return <H key={key}>{kids(node)}</H>; }
    case 'paragraph': return <p key={key}>{kids(node)}</p>;
    case 'list': return node.ordered ? <ol key={key}>{kids(node)}</ol> : <ul key={key}>{kids(node)}</ul>;
    case 'listItem': return <li key={key}>{node.children.flatMap((c, i) => (c.type === 'paragraph' ? c.children.map((g, j) => render(g, `${i}-${j}`)) : [render(c, i)]))}</li>;
    // Links are shown, not followed: clicking inside the editor must not navigate away from unsaved edits.
    case 'link': return <a key={key} href={node.url} onClick={(e) => e.preventDefault()}>{kids(node)}</a>;
    case 'strong': return <strong key={key}>{kids(node)}</strong>;
    case 'emphasis': return <em key={key}>{kids(node)}</em>;
    case 'inlineCode': return <code key={key}>{node.value}</code>;
    case 'text': return node.value;
    case 'thematicBreak': return <hr key={key} />;
    default: return 'value' in node && typeof node.value === 'string' ? node.value : null;
  }
}

export function PageOkfGeneratedElement(props: PlateElementProps) {
  const raw = String(props.element.raw ?? '');
  const tree = useMemo(() => parser.parse(okfInnerMarkdown(raw)), [raw]);
  return (
    <PlateElement {...props} className="ped-okf">
      <div contentEditable={false} className="ped-okf-block select-none" data-testid="okf-generated" aria-readonly="true">
        <span className="ped-okf-badge">Generated index (updates on save)</span>
        {render(tree, 'root')}
      </div>
      {props.children}
    </PlateElement>
  );
}
