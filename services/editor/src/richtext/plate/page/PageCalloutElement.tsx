// "Page look" admonition (:::note, :::tip, ...): the page's own Admonition component from the skin, with
// the editable blocks as its children. Its heading (icon + title) is page markup, not document content,
// so it is made non-editable once mounted. Without a skin, the editor's own callout is used.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { useRichTextSkin } from '../../skin.js';
import { CalloutElement } from '../nodes/CalloutElement.js';

/** Marks every child of the admonition that does not hold the editable blocks as contentEditable=false. */
function LockChrome({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current?.firstElementChild;
    if (!root) return;
    for (const child of Array.from(root.children)) {
      if (child.querySelector('[data-slate-node]')) continue;
      child.setAttribute('contenteditable', 'false');
      child.setAttribute('data-ped-chrome', '');
    }
  });
  return <div ref={ref} className="ped-admonition">{children}</div>;
}

export function PageCalloutElement(props: PlateElementProps) {
  const { Admonition } = useRichTextSkin();
  if (!Admonition) return <CalloutElement {...props} />;
  const variant = typeof props.element.variant === 'string' && props.element.variant ? props.element.variant : 'note';
  const title = typeof props.element.title === 'string' && props.element.title ? props.element.title : undefined;
  return (
    <PlateElement {...props}>
      <LockChrome>
        <Admonition type={variant} title={title}>{props.children}</Admonition>
      </LockChrome>
    </PlateElement>
  );
}
