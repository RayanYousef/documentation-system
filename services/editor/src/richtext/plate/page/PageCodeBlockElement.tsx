// "Page look" code block: a plain <pre><code> (styled by the page like a rendered code block) with the
// lowlight token spans, plus the language picker and copy button in its top-right corner.
import type { TCodeBlockElement } from 'platejs';
import { NodeApi } from 'platejs';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { CodeBlockCombobox, CopyButton } from '../ui/code-block-node.js';

export function PageCodeBlockElement(props: PlateElementProps<TCodeBlockElement>) {
  const { element } = props;
  return (
    <PlateElement {...props} className="docs-code-block ped-code-block">
      <div className="relative">
        <pre className="ped-pre">
          <code>{props.children}</code>
        </pre>
        <div contentEditable={false} className="absolute top-1 right-1 z-10 flex gap-0.5 select-none">
          <CodeBlockCombobox showLanguageLabel />
          <CopyButton size="icon" variant="ghost" className="size-6 gap-1 text-xs text-muted-foreground" value={() => NodeApi.string(element)} />
        </div>
      </div>
    </PlateElement>
  );
}
