// <Tabs>: a container whose children are TabItem blocks (the normalizers in docsNodesKit keep it so).
// Its props (groupId) come from the components manifest; "Add tab" appends a TabItem.
import { PlateElement, type PlateElementProps, useEditorRef, useReadOnly } from 'platejs/react';
import { Layers, Plus } from 'lucide-react';
import { useDocsComponents } from '../context.js';
import { addTab } from '../editor/transforms.js';
import { descriptorFor } from '../markdown/componentRules.js';
import { PropFields, fieldsFor } from './PropFields.js';

export function TabsElement(props: PlateElementProps) {
  const { element } = props;
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const manifest = useDocsComponents();
  const descriptor = descriptorFor(manifest, element);
  const tag = typeof element.jsxName === 'string' ? element.jsxName : descriptor?.name ?? 'Tabs';
  const groupId = element.groupId;
  return (
    <PlateElement {...props} className="my-3 rounded-lg border border-border p-2">
      <div contentEditable={false} className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 font-medium select-none"><Layers className="size-3.5" /> {tag}</span>
        {readOnly
          ? typeof groupId === 'string' && groupId ? <span className="font-mono">groupId={groupId}</span> : null
          : <>
              <PropFields element={element} props={fieldsFor(descriptor, element)} tag={tag} className="flex flex-1 items-center gap-2" />
              <button type="button" className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 hover:bg-accent"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => addTab(editor, manifest, editor.api.findPath(element) ?? props.path)}>
                <Plus className="size-3" /> Add tab
              </button>
            </>}
      </div>
      {props.children}
    </PlateElement>
  );
}
