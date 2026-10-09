// "Page look" <Tabs>/<TabItem>: the same Infima markup the site renders (tabs-container, tabs,
// tabs__item--active), with one panel shown at a time. The tab header is page chrome (non-editable):
// click switches tabs, double-click edits a tab's props (value, label, default), the gear edits the
// Tabs props (groupId), "Add tab" appends one. A tab that holds the caret is shown automatically.
import { createContext, useContext, useEffect, useState, type MouseEvent } from 'react';
import { ElementApi, type TElement } from 'platejs';
import { PlateElement, useEditorRef, useEditorSelector, useReadOnly, type PlateElementProps } from 'platejs/react';
import { Plus, Settings2 } from 'lucide-react';
import { useDocsComponents } from '../context.js';
import { addTab } from '../editor/transforms.js';
import { descriptorFor } from '../markdown/componentRules.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { PropFields, fieldsFor } from '../nodes/PropFields.js';

const ActiveTab = createContext<number>(0);
const keep = (e: MouseEvent) => e.preventDefault(); // header clicks must not move the caret

const tabLabel = (item: TElement, i: number): string =>
  (typeof item.label === 'string' && item.label) || (typeof item.value === 'string' && item.value) || `Tab ${i + 1}`;

export function PageTabsElement(props: PlateElementProps) {
  const { element } = props;
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const manifest = useDocsComponents();
  const items = element.children.filter((c): c is TElement => ElementApi.isElement(c) && c.type === DOCS_KEYS.tabItem);
  const initial = Math.max(0, items.findIndex((i) => i.default === true));
  const [active, setActive] = useState(initial);
  const [editing, setEditing] = useState<'tabs' | number | null>(null);
  const shown = Math.min(active, Math.max(0, items.length - 1));

  // Show the tab that holds the caret (arrow keys, search, undo can move it into a hidden panel).
  const caretTab = useEditorSelector((ed) => {
    const sel = ed.selection?.anchor.path;
    const here = ed.api.findPath(element);
    if (!sel || !here || sel.length <= here.length || here.some((v, i) => sel[i] !== v)) return -1;
    return sel[here.length] ?? -1;
  }, [element]);
  useEffect(() => { if (caretTab >= 0) setActive(caretTab); }, [caretTab]);

  const tabsDescriptor = descriptorFor(manifest, element);
  const tabsTag = typeof element.jsxName === 'string' ? element.jsxName : tabsDescriptor?.name ?? 'Tabs';
  const editedItem = typeof editing === 'number' ? items[editing] : undefined;
  const itemDescriptor = editedItem ? descriptorFor(manifest, editedItem) : undefined;
  const itemTag = editedItem && typeof editedItem.jsxName === 'string' ? editedItem.jsxName : itemDescriptor?.name ?? 'TabItem';

  return (
    <PlateElement {...props} className="tabs-container ped-tabs">
      <div contentEditable={false} className="select-none">
        <ul role="tablist" aria-orientation="horizontal" className="tabs">
          {items.map((item, i) => (
            <li key={i} role="tab" tabIndex={-1} aria-selected={i === shown}
              className={`tabs__item${i === shown ? ' tabs__item--active' : ''}`}
              title={readOnly ? undefined : 'Double-click to edit this tab'}
              onMouseDown={keep}
              onClick={() => setActive(i)}
              onDoubleClick={() => { if (!readOnly) { setActive(i); setEditing(i); } }}>
              {tabLabel(item, i)}
            </li>
          ))}
          {!readOnly && (
            <li className="ped-tabs-actions">
              <button type="button" className="ped-chip" onMouseDown={keep}
                onClick={() => { addTab(editor, manifest, editor.api.findPath(element) ?? props.path); setActive(items.length); }}>
                <Plus className="size-3" /> Add tab
              </button>
              <button type="button" className="ped-chip" aria-label={`${tabsTag} settings`} aria-pressed={editing === 'tabs'} onMouseDown={keep}
                onClick={() => setEditing(editing === 'tabs' ? null : 'tabs')}>
                <Settings2 className="size-3" />
              </button>
            </li>
          )}
        </ul>
        {!readOnly && editing !== null && (
          <div className="ped-props" role="group" aria-label={editing === 'tabs' ? `${tabsTag} props` : `${itemTag} props`}>
            {editing === 'tabs'
              ? <PropFields element={element} props={fieldsFor(tabsDescriptor, element)} tag={tabsTag} />
              : editedItem && <PropFields element={editedItem} props={fieldsFor(itemDescriptor, editedItem)} tag={itemTag} />}
            <button type="button" className="ped-chip" onMouseDown={keep} onClick={() => setEditing(null)}>Done</button>
          </div>
        )}
      </div>
      <ActiveTab.Provider value={shown}>
        <div className="margin-top--md">{props.children}</div>
      </ActiveTab.Provider>
    </PlateElement>
  );
}

export function PageTabItemElement(props: PlateElementProps) {
  const active = useContext(ActiveTab);
  const index = props.path.at(-1) ?? 0;
  const hidden = index !== active;
  return <PlateElement {...props} attributes={{ ...props.attributes, role: 'tabpanel', hidden } as PlateElementProps['attributes']} />;
}
