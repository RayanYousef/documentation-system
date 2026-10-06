// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_COMPONENTS } from '../../mdx/componentsManifest.js';
import type { RichTextHandle, RichTextParseError, RichTextServices } from '../RichTextEditor.js';
import { PlateRichTextEditor } from './PlateRichTextEditor.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@platform/viewers', () => ({ ModelViewerCore: () => null, FbxViewerCore: () => null }));

beforeAll(() => {
  class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect ??= rect;
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

const services: RichTextServices = {
  baseUrl: '/Base/',
  uploadImage: vi.fn(),
  uploadModel: vi.fn(),
  listAssets: vi.fn(async () => []),
  getAsset: vi.fn(async () => new Blob()),
  defaultRef: () => 'main',
};

const roots: Root[] = [];
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); document.body.innerHTML = ''; });

async function mount(markdown: string, readOnly = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const onChange = vi.fn();
  const onParseError = vi.fn<(e: RichTextParseError) => void>();
  const handle = createRef<RichTextHandle>();
  await act(async () => root.render(
    <PlateRichTextEditor ref={handle} markdown={markdown} readOnly={readOnly} components={DEFAULT_COMPONENTS} services={services} onChange={onChange} onParseError={onParseError} />,
  ));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  return { host, onChange, onParseError, handle, button };
}

const TOOLBAR = [
  'Undo', 'Redo', 'Block type', 'Bold (Ctrl+B)', 'Italic (Ctrl+I)', 'Underline (Ctrl+U)', 'Strikethrough', 'Inline code (Ctrl+E)',
  'Bulleted list', 'Numbered list', 'To-do list', 'Link', 'Insert image by URL', 'Upload image', 'Insert 3D model (.glb, .gltf, .fbx)',
  'Insert from repo (existing models and images)', 'Table', 'Insert code block', 'Insert thematic break', 'Insert admonition', 'Insert tabs', 'Insert component',
];

describe('PlateRichTextEditor', () => {
  it('shows the full toolbar in the documented order above the page', async () => {
    const m = await mount('\nSome text.\n');
    const toolbar = m.host.querySelector('[role="toolbar"][aria-label="Formatting"]');
    expect(toolbar).not.toBeNull();
    const labels = [...toolbar!.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(TOOLBAR);
    expect(m.host.querySelector('[data-slate-editor]')).not.toBeNull();
    expect(m.onChange).not.toHaveBeenCalled();
    expect(m.handle.current!.getMarkdown()).toBe('\nSome text.\n');
  });

  it('hides every toolbar when read-only', async () => {
    const m = await mount('\nSome text.\n', true);
    expect(m.host.querySelector('[role="toolbar"]')).toBeNull();
    expect(m.host.querySelector('[data-slate-editor]')?.getAttribute('contenteditable')).toBe('false');
  });

  it('renders nothing and reports a parse error for a body it cannot import', async () => {
    const m = await mount('\nimport X from "y";\n\nText.\n');
    expect(m.onParseError).toHaveBeenCalledTimes(1);
    expect(m.host.querySelector('[role="toolbar"]')).toBeNull();
    expect(m.host.querySelector('[data-slate-editor]')).toBeNull();
  });
});
