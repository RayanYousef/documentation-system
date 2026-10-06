// <TabItem>: a container whose children are normal Markdown blocks. Its props (value, label, default)
// come from the components manifest.
import { PlateElement, type PlateElementProps, useReadOnly } from 'platejs/react';
import { useDocsComponents } from '../context.js';
import { descriptorFor } from '../markdown/componentRules.js';
import { PropFields, fieldsFor } from './PropFields.js';

export function TabItemElement(props: PlateElementProps) {
  const { element } = props;
  const readOnly = useReadOnly();
  const descriptor = descriptorFor(useDocsComponents(), element);
  const tag = typeof element.jsxName === 'string' ? element.jsxName : descriptor?.name ?? 'TabItem';
  const { value, label } = element;
  return (
    <PlateElement {...props} className="my-2 rounded-md border border-border/70 bg-muted/40 px-3 py-1">
      {readOnly
        ? (
          <div contentEditable={false} className="text-xs text-muted-foreground select-none">
            {tag} value=<b>{String(value ?? '')}</b> label=<b>{String(label ?? '')}</b>
            {element.default === true ? ' (default)' : ''}
          </div>
        )
        : <PropFields element={element} props={fieldsFor(descriptor, element)} tag={tag} className="mb-1 flex flex-wrap items-center gap-2 text-xs [&_input[type=text]]:w-32" />}
      {props.children}
    </PlateElement>
  );
}
