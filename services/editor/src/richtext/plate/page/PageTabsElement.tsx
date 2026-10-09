// "Page look" <Tabs>/<TabItem>: the same Infima markup the site renders (tabs-container, tabs,
// tabs__item--active), with one panel shown at a time. The tab header is page chrome (non-editable):
// click a tab to show it; click the shown tab's label to rename it in place (Enter saves, Escape cancels);
// the chips move the shown tab left or right, remove it, open its props (value, label, default),
// open the Tabs props (gear, groupId) and add a tab. A tab that holds the caret is shown automatically.
import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ElementApi, type TElement } from 'platejs';
import { PlateElement, useEditorRef, useEditorSelector, useReadOnly, type PlateElementProps } from 'platejs/react';
import { ChevronLeft, ChevronRight, Plus, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useDocsComponents } from '../context.js';
import { addTab, moveTab, removeTab, renameTab } from '../editor/transforms.js';
import { descriptorFor } from '../markdown/componentRules.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { PropFields, fieldsFor } from '../nodes/PropFields.js';

const ActiveTab = createContext<number>(0);
const keep = (e: MouseEvent) => e.preventDefault(); // header clicks must not move the caret

const tabLabel = (item: TElement, i: number): string =>
  (typeof item.label === 'string' && item.label) || (typeof item.value === 'string' && item.value) || `Tab ${i + 1}`;

/** The label of a tab as a text box: Enter or leaving the box saves, Escape cancels. */
function TabNameInput({ initial, onDone }: { initial: string; onDone(name: string | null): void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (name: string | null) => { if (!done.current) { done.current = true; onDone(name); } };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // the editor must not see these keys
    if (e.key === 'Enter') { e.preventDefault(); finish(value); }
    if (e.key === 'Escape') { e.preventDefault(); finish(null); }
  };
  return (
    <input className="ped-tab-name" aria-label="Tab name" value={value} size={Math.max(6, value.length + 1)} autoFocus
      onFocus={(e) => e.currentTarget.select()} onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown}
      onBlur={() => finish(value)} onClick={(e) => e.stopPropagation()} />
  );
}

export function PageTabsElement(props: PlateElementProps) {
  const { element } = props;
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const manifest = useDocsComponents();
  const items = element.children.filter((c): c is TElement => ElementApi.isElement(c) && c.type === DOCS_KEYS.tabItem);
  const initial = Math.max(0, items.findIndex((i) => i.default === true));
  const [active, setActive] = useState(initial);
  const [editing, setEditing] = useState<'tabs' | number | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
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
  const path = () => editor.api.findPath(element) ?? props.path;

  const clickTab = (i: number) => {
    if (readOnly) { setActive(i); return; }
    if (i === shown) { setRenaming(i); setEditing(null); return; }
    setRenaming(null);
    setActive(i);
    if (typeof editing === 'number') setEditing(i); // the open tab props follow the shown tab
  };
  const move = (to: number) => { moveTab(editor, path(), shown, to); setActive(to); setRenaming(null); if (editing !== 'tabs') setEditing(null); };
  const remove = () => { removeTab(editor, path(), shown); setActive(Math.max(0, shown - 1)); setRenaming(null); if (editing !== 'tabs') setEditing(null); };

  return (
    <PlateElement {...props} className="tabs-container ped-tabs">
      <div contentEditable={false} className="select-none">
        <ul role="tablist" aria-orientation="horizontal" className="tabs">
          {items.map((item, i) => (
            <li key={i} role="tab" tabIndex={-1} aria-selected={i === shown}
              className={`tabs__item${i === shown ? ' tabs__item--active' : ''}`}
              title={readOnly ? undefined : i === shown ? 'Click to rename this tab' : 'Click to show this tab'}
              onMouseDown={renaming === i ? undefined : keep}
              onClick={() => { if (renaming !== i) clickTab(i); }}>
              {renaming === i && !readOnly
                ? <TabNameInput initial={tabLabel(item, i)} onDone={(name) => { if (name !== null) renameTab(editor, path(), i, name); setRenaming(null); }} />
                : tabLabel(item, i)}
            </li>
          ))}
          {!readOnly && (
            <li className="ped-tabs-actions">
              <button type="button" className="ped-chip" aria-label="Move tab left" title="Move tab left" disabled={shown === 0} onMouseDown={keep} onClick={() => move(shown - 1)}>
                <ChevronLeft className="size-3" />
              </button>
              <button type="button" className="ped-chip" aria-label="Move tab right" title="Move tab right" disabled={shown >= items.length - 1} onMouseDown={keep} onClick={() => move(shown + 1)}>
                <ChevronRight className="size-3" />
              </button>
              <button type="button" className="ped-chip" aria-label="Remove tab" title={items.length <= 1 ? 'The last tab cannot be removed' : 'Remove this tab and its content'} disabled={items.length <= 1} onMouseDown={keep} onClick={remove}>
                <Trash2 className="size-3" />
              </button>
              <button type="button" className="ped-chip" aria-label="Tab settings" title="Value, label and default of this tab" aria-pressed={editing === shown} onMouseDown={keep}
                onClick={() => { setRenaming(null); setEditing(editing === shown ? null : shown); }}>
                <SlidersHorizontal className="size-3" />
              </button>
              <button type="button" className="ped-chip" onMouseDown={keep}
                onClick={() => { addTab(editor, manifest, path()); setActive(items.length); setRenaming(null); }}>
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
