// A manifest component with preview "generic": shows the tag and its attributes.
// jsx_void has no children; jsx_container has editable Markdown children.
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { Puzzle } from 'lucide-react';
import { writeJsxAttributes } from '../markdown/jsxAttributes.js';

const attrText = (element: Record<string, unknown>): string =>
  writeJsxAttributes(element, []).map((a) => {
    if (a.type === 'mdxJsxExpressionAttribute') return `{${a.value}}`;
    if (a.value === null || a.value === undefined) return a.name;
    return typeof a.value === 'string' ? `${a.name}="${a.value}"` : `${a.name}={${a.value.value}}`;
  }).join(' ');

function Header({ element, selfClosing }: { element: Record<string, unknown>; selfClosing: boolean }) {
  const name = typeof element.jsxName === 'string' ? element.jsxName : 'Component';
  const attrs = attrText(element);
  return (
    <div contentEditable={false} className="mb-1 flex items-center gap-2 text-xs text-muted-foreground select-none">
      <Puzzle className="size-3.5" />
      <code className="font-mono">{`<${name}${attrs ? ` ${attrs}` : ''}${selfClosing ? ' />' : '>'}`}</code>
      <span className="ml-auto">edit its props in Raw mode</span>
    </div>
  );
}

export function GenericJsxVoidElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} className="my-3">
      <div contentEditable={false} className="rounded-lg border border-dashed border-border p-2">
        <Header element={props.element} selfClosing />
      </div>
      {props.children}
    </PlateElement>
  );
}

export function GenericJsxContainerElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} className="my-3 rounded-lg border border-dashed border-border p-2">
      <Header element={props.element} selfClosing={false} />
      {props.children}
    </PlateElement>
  );
}
