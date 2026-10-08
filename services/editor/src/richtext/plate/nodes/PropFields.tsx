// Inputs for the props of a manifest component (ModelViewer, FbxViewer, Tabs, TabItem).
// - string:  '' removes the prop
// - number:  '' removes it, a number is stored as a number (written as `{n}`), anything else is ignored
// - boolean: checked is a bare attribute, unchecked removes it
// A prop that holds another expression (`{size * 2}`) is shown, not edited: edit it in Raw mode.
// The inputs sit in a contentEditable={false} box and keep keys and clicks away from the editor.
import type { KeyboardEvent, MouseEvent } from 'react';
import type { TElement } from 'platejs';
import { useEditorRef } from 'platejs/react';
import type { ComponentDescriptor, ComponentProp } from '@platform/contracts';
import { toNodeKey } from '../markdown/jsxAttributes.js';

const stop = (e: KeyboardEvent | MouseEvent) => e.stopPropagation();

/** The props to show: the manifest's, else the ones the node was read with. */
export function fieldsFor(descriptor: ComponentDescriptor | undefined, element: TElement): ComponentProp[] {
  if (descriptor) return descriptor.props;
  const order = Array.isArray(element.attrOrder) ? (element.attrOrder as string[]) : [];
  return order.filter((n) => !n.startsWith('#')).map((name) => {
    const v = element[toNodeKey(name)];
    return { name, type: typeof v === 'number' ? 'number' : v === true ? 'boolean' : 'string' };
  });
}

/** The value to store for an input's text, or `null` to ignore the change. */
export function parsePropInput(type: ComponentProp['type'], text: string): string | number | undefined | null {
  if (type !== 'number') return text === '' ? undefined : text;
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const fieldClass = 'h-7 w-full min-w-0 rounded border border-input bg-field px-2 font-mono text-xs text-foreground';

export function PropFields({ element, props, tag, className }: { element: TElement; props: readonly ComponentProp[]; tag: string; className?: string }) {
  const editor = useEditorRef();
  const set = (name: string, value: string | number | true | undefined) => {
    const key = toNodeKey(name);
    if (value === undefined) editor.tf.unsetNodes(key, { at: element });
    else editor.tf.setNodes({ [key]: value } as Partial<TElement>, { at: element });
  };
  if (!props.length) return null;
  return (
    <div contentEditable={false} onKeyDown={stop} onMouseDown={stop} className={className ?? 'grid grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-1'}>
      {props.map((p) => {
        const v = element[toNodeKey(p.name)];
        const label = `${tag} ${p.name}`;
        const expression = v !== null && typeof v === 'object' ? `{${String((v as { expression?: unknown }).expression)}}` : null;
        return (
          <label key={p.name} className="contents">
            <span className="font-mono text-xs text-muted-foreground">{p.name}</span>
            {expression !== null || (p.type === 'number' && v !== undefined && typeof v !== 'number')
              ? <code title="Edit this expression in Raw mode" className="font-mono text-xs">{expression ?? String(v)}</code>
              : p.type === 'boolean'
                ? <input type="checkbox" aria-label={label} className="size-4 justify-self-start" checked={v === true} onChange={(e) => set(p.name, e.target.checked ? true : undefined)} />
                : <input type={p.type === 'number' ? 'number' : 'text'} aria-label={label} className={fieldClass} value={v === undefined ? '' : String(v)}
                    onChange={(e) => { const next = parsePropInput(p.type, e.target.value); if (next !== null) set(p.name, next); }} />}
          </label>
        );
      })}
    </div>
  );
}
