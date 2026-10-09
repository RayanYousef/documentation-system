// "Page look" text blocks: plain semantic elements with no styling of their own, so the page's
// stylesheet (Infima's element and `.markdown` rules on the docs site) styles them exactly like the
// rendered page. Only editor affordances (selection, focus) come from the editor.
import { PlateElement, useFocused, useReadOnly, useSelected, type PlateElementProps } from 'platejs/react';

const heading = (as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  function PageHeading(props: PlateElementProps) {
    return <PlateElement as={as} {...props} />;
  };

export const PageH1Element = heading('h1');
export const PageH2Element = heading('h2');
export const PageH3Element = heading('h3');
export const PageH4Element = heading('h4');
export const PageH5Element = heading('h5');
export const PageH6Element = heading('h6');

export function PageParagraphElement(props: PlateElementProps) {
  return <PlateElement as="p" {...props} />;
}

export function PageBlockquoteElement(props: PlateElementProps) {
  return <PlateElement as="blockquote" {...props} />;
}

export function PageHrElement(props: PlateElementProps) {
  const readOnly = useReadOnly();
  const selected = useSelected();
  const focused = useFocused();
  return (
    <PlateElement {...props}>
      <div contentEditable={false} className={!readOnly ? 'cursor-pointer' : undefined} data-selected={selected && focused ? 'true' : undefined}>
        <hr className="ped-hr" />
      </div>
      {props.children}
    </PlateElement>
  );
}
