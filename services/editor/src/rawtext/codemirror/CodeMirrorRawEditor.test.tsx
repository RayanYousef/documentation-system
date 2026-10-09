// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, StrictMode, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { RawTextEditor } from '../index.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
let container: HTMLElement;
async function render(el: ReactElement, root?: Root): Promise<Root> {
  if (!root) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    roots.push(root);
  }
  await act(async () => root!.render(<StrictMode>{el}</StrictMode>));
  return root;
}
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); document.body.innerHTML = ''; });

const content = () => container.querySelector<HTMLElement>('.cm-content')!;
const view = () => EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;

describe('CodeMirror raw editor', () => {
  it('shows the value in one editor with the accessible name', async () => {
    await render(<RawTextEditor value={'---\ntitle: A\n---\n\n# Body\n'} readOnly={false} ariaLabel="Raw MDX" onChange={() => {}} />);
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1);
    expect(content().getAttribute('aria-label')).toBe('Raw MDX');
    expect(view().state.doc.toString()).toBe('---\ntitle: A\n---\n\n# Body\n');
  });

  it('reports user edits with the full text', async () => {
    const onChange = vi.fn();
    await render(<RawTextEditor value="abc" readOnly={false} ariaLabel="Raw" onChange={onChange} />);
    await act(async () => { view().dispatch({ changes: { from: 3, insert: 'd' }, userEvent: 'input.type' }); });
    expect(onChange).toHaveBeenLastCalledWith('abcd');
  });

  it('read-only: not editable and the state refuses input', async () => {
    await render(<RawTextEditor value="abc" readOnly ariaLabel="Raw" onChange={() => {}} />);
    expect(content().getAttribute('contenteditable')).toBe('false');
    expect(view().state.readOnly).toBe(true);
  });

  it('applies an outside value without reporting it back, and ignores an equal value', async () => {
    const onChange = vi.fn();
    const root = await render(<RawTextEditor value="one" readOnly={false} ariaLabel="Raw" onChange={onChange} />);
    const before = view();
    await render(<RawTextEditor value="two" readOnly={false} ariaLabel="Raw" onChange={onChange} />, root);
    expect(view()).toBe(before);
    expect(view().state.doc.toString()).toBe('two');
    await render(<RawTextEditor value="two" readOnly={false} ariaLabel="Raw" onChange={onChange} />, root);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switches read-only without remounting', async () => {
    const root = await render(<RawTextEditor value="x" readOnly ariaLabel="Raw" onChange={() => {}} />);
    await render(<RawTextEditor value="x" readOnly={false} ariaLabel="Raw" onChange={() => {}} />, root);
    expect(content().getAttribute('contenteditable')).toBe('true');
    expect(view().state.readOnly).toBe(false);
  });
});
