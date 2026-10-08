// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TElement } from 'platejs';
import type { PlateEditor } from 'platejs/react';
import { DEFAULT_COMPONENTS } from '../../mdx/componentsManifest.js';
import { splitDocument } from '../../frontmatter/yamlDoc.js';
import type { RichTextHandle, RichTextParseError, RichTextServices } from '../RichTextEditor.js';
import { DocsEditorProvider } from './context.js';
import { CoreKit } from './kits/content-kit.js';
import { buildDocsMarkdown, exportBody } from './markdown/docsMarkdown.js';
import { PlateDocument } from './PlateDocument.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// No WebGL in jsdom: the previews render a marker instead.
vi.mock('@platform/viewers', () => ({
  ModelViewerCore: ({ src, height }: { src: string; height?: number }) => <div data-testid="model-preview" data-src={src} data-height={height} />,
  FbxViewerCore: ({ src, height }: { src: string; height?: number }) => <div data-testid="fbx-preview" data-src={src} data-height={height} />,
}));

const services: RichTextServices = {
  baseUrl: '/Base/',
  uploadImage: vi.fn(),
  uploadModel: vi.fn(),
  listAssets: vi.fn(async () => []),
  getAsset: vi.fn(async () => new Blob(['fbx'])),
  defaultRef: () => 'main',
};

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'markdown', '__fixtures__');
const body = (file: string) => splitDocument(readFileSync(join(FIXTURES, file), 'utf8')).body;

beforeAll(() => {
  // jsdom lacks layout APIs that Slate (scroll into view) and the floating UI call.
  class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect ??= rect;
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
});

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
  const editorRef = createRef<PlateEditor>();
  await act(async () => root.render(
    <DocsEditorProvider services={services} components={DEFAULT_COMPONENTS}>
      <PlateDocument markdown={markdown} readOnly={readOnly} components={DEFAULT_COMPONENTS} plugins={CoreKit}
        onChange={onChange} onParseError={onParseError} ref={handle} editorRef={editorRef} />
    </DocsEditorProvider>,
  ));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { host, onChange, onParseError, handle, editor: () => editorRef.current!, getMarkdown: () => handle.current!.getMarkdown() };
}
const flush = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

/** Type into a React-controlled input. */
function typeInto(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const field = (host: HTMLElement, label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

describe('PlateDocument', () => {
  it.each(['pages/assets__airship-model.md', 'constructs-fixture.md', 'tabs-fixture.md'])('mounting %s does not report a change', async (file) => {
    const m = await mount(body(file));
    expect(m.host.querySelector('[data-slate-editor]')).not.toBeNull();
    expect(m.onParseError).not.toHaveBeenCalled();
    expect(m.onChange).not.toHaveBeenCalled();
  });

  it.each(['pages/assets__airship-model.md', 'pages/platform__okf-core.md', 'pages/index.md', 'constructs-fixture.md', 'tabs-fixture.md'])(
    'getMarkdown() returns the loaded body of %s byte for byte', async (file) => {
      const input = body(file);
      const m = await mount(input);
      expect(m.getMarkdown()).toBe(input);
    });

  it('reports the first real edit once and returns the exported Markdown', async () => {
    const m = await mount(body('pages/assets__airship-model.md'));
    const editor = m.editor();
    await act(async () => { editor.tf.select(editor.api.end([0])); });
    await flush();
    expect(m.onChange).not.toHaveBeenCalled();
    for (const ch of ['!', '?', '.']) {
      await act(async () => { editor.tf.insertText(ch); });
      await flush();
    }
    expect(m.onChange).toHaveBeenCalledTimes(1);
    const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
    expect(m.getMarkdown()).toBe(exportBody(editor, editor.children, '*', md));
    expect(m.getMarkdown()).toContain('!?.');
  });

  it('a viewer prop edit marks the page changed and is written out', async () => {
    const m = await mount(body('pages/assets__airship-model.md'));
    const editor = m.editor();
    const path = editor.children.findIndex((n) => n.type === 'fbx_viewer');
    expect(path).toBeGreaterThanOrEqual(0);
    await act(async () => { editor.tf.setNodes({ height: 500 } as Partial<TElement>, { at: [path] }); });
    await flush();
    expect(m.onChange).toHaveBeenCalledTimes(1);
    expect(m.getMarkdown()).toContain('height={500}');
  });

  it('a body it cannot import calls onParseError once, renders nothing and keeps the input', async () => {
    const input = '\n## Title\n\n<FbxViewer repo="a/b" path="x.fbx"\n\nMore text.\n';
    const m = await mount(input);
    expect(m.onParseError).toHaveBeenCalledTimes(1);
    expect(m.onParseError.mock.calls[0]![0].source).toBe(input);
    expect(m.onParseError.mock.calls[0]![0].error).not.toBe('');
    expect(m.host.querySelector('[data-slate-editor]')).toBeNull();
    expect(m.getMarkdown()).toBe(input);
    expect(m.onChange).not.toHaveBeenCalled();
  });

  it('an empty body mounts without errors', async () => {
    const m = await mount('');
    expect(m.onParseError).not.toHaveBeenCalled();
    expect(m.host.querySelector('[data-slate-editor]')).not.toBeNull();
    expect(m.getMarkdown()).toBe('');
    expect(m.onChange).not.toHaveBeenCalled();
  });

  it('read-only renders a non-editable surface without prop inputs', async () => {
    const m = await mount(body('pages/assets__airship-model.md'), true);
    expect(m.host.querySelector('[data-slate-editor]')?.getAttribute('contenteditable')).toBe('false');
    expect(m.host.querySelector('input[aria-label="FbxViewer alt"]')).toBeNull();
  });

  it('shows the real viewer previews: src through the base url, repo + path through the backend', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:airship');
    URL.revokeObjectURL = vi.fn();
    const m = await mount(body('pages/assets__airship-model.md'));
    await flush(350); // the url waits for the props to settle
    for (let i = 0; i < 50 && m.host.querySelectorAll("[data-testid$=-preview]").length < 2; i++) await flush(20); // lazy viewers
    const model = m.host.querySelector('[data-testid="model-preview"]');
    expect(model?.getAttribute('data-src')).toBe('/Base/models/cube.gltf');
    expect(model?.getAttribute('data-height')).toBe('320');
    expect(services.getAsset).toHaveBeenCalledWith({ repo: 'RayanYousef/documentation-system', ref: 'main', path: 'examples/unity-project/Assets/Models/Airship.fbx' });
    expect(m.host.querySelector('[data-testid="fbx-preview"]')?.getAttribute('data-src')).toBe('blob:airship');
    expect(m.onChange).not.toHaveBeenCalled();
  });

  it('edits viewer props through the manifest inputs and keeps the attribute order', async () => {
    const m = await mount(body('pages/assets__airship-model.md'));
    const before = m.getMarkdown();
    const line = before.split('\n').find((l) => l.startsWith('<FbxViewer'))!;
    await act(async () => typeInto(field(m.host, 'FbxViewer alt'), 'Airship (big)'));
    await act(async () => typeInto(field(m.host, 'FbxViewer height'), '500'));
    await flush();
    expect(m.onChange).toHaveBeenCalledTimes(1);
    const after = m.getMarkdown();
    // The export has no leading blank line; App puts it back after the frontmatter.
    expect(after).toBe(before.replace(line, line.replace('alt="Airship"', 'alt="Airship (big)"').replace('height={400}', 'height={500}')).replace(/^\n/, ''));
    await act(async () => typeInto(field(m.host, 'FbxViewer height'), ''));
    expect(m.getMarkdown()).not.toContain('height={500}');
  });

  it('edits TabItem props and adds a tab', async () => {
    const m = await mount(body('tabs-fixture.md'));
    const value = m.host.querySelector<HTMLInputElement>('input[aria-label="TabItem value"]')!;
    await act(async () => typeInto(value, 'renamed'));
    const add = [...m.host.querySelectorAll('button')].find((b) => b.textContent?.includes('Add tab'))!;
    const tabsBefore = m.editor().children.find((n) => n.type === 'tabs')!.children.length;
    await act(async () => { add.click(); });
    await flush();
    expect(m.editor().children.find((n) => n.type === 'tabs')!.children.length).toBe(tabsBefore + 1);
    expect(m.getMarkdown()).toContain('value="renamed"');
    expect(m.onChange).toHaveBeenCalledTimes(1);
  });
});
