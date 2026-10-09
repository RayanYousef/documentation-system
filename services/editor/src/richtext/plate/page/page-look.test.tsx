// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KEYS } from 'platejs';
import { createPlateEditor, type PlateEditor } from 'platejs/react';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import type { RichTextHandle, RichTextServices } from '../../RichTextEditor.js';
import { RichTextSkinProvider, type RichTextSkin } from '../../skin.js';
import { DocsEditorProvider } from '../context.js';
import { CoreKit } from '../kits/content-kit.js';
import { PAGE_LOOK_COMPONENTS, withPageLook } from '../kits/page-look-kit.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { PlateDocument } from '../PlateDocument.js';
import { PageCalloutElement } from './PageCalloutElement.js';
import { PageTabsElement } from './PageTabsElement.js';
import { PageH2Element, PageParagraphElement } from './PageTextElements.js';
import { okfInnerMarkdown } from './PageOkfGeneratedElement.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@platform/viewers', () => ({
  ModelViewerCore: ({ src, height }: { src: string; height?: number }) => <div data-testid="model-preview" data-src={src} data-height={height} />,
  FbxViewerCore: ({ src, height }: { src: string; height?: number }) => <div data-testid="fbx-preview" data-src={src} data-height={height} />,
}));

const services: RichTextServices = {
  baseUrl: '/Base/', uploadImage: vi.fn(), uploadModel: vi.fn(), listAssets: vi.fn(async () => []), getAsset: vi.fn(async () => new Blob(['x'])), defaultRef: () => 'main',
};

beforeAll(() => {
  class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect ??= rect;
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
});

const roots: Root[] = [];
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); document.body.innerHTML = ''; });

/** Stands in for the site's Admonition (the skin the site injects). */
function FakeAdmonition({ type, title, children }: { type: string; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`theme-admonition theme-admonition-${type} alert`}>
      <div className="admonitionHeading"><span className="icon">!</span>{title ?? type.toUpperCase()}</div>
      <div className="admonitionContent">{children}</div>
    </div>
  );
}

async function mount(markdown: string, { skin = {}, readOnly = false }: { skin?: RichTextSkin; readOnly?: boolean } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const handle = createRef<RichTextHandle>();
  const editorRef = createRef<PlateEditor>();
  await act(async () => root.render(
    <RichTextSkinProvider skin={skin}>
      <DocsEditorProvider services={services} components={DEFAULT_COMPONENTS}>
        <PlateDocument markdown={markdown} readOnly={readOnly} components={DEFAULT_COMPONENTS} plugins={withPageLook(CoreKit)} variant="page"
          onChange={() => {}} onParseError={() => {}} ref={handle} editorRef={editorRef} />
      </DocsEditorProvider>
    </RichTextSkinProvider>,
  ));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { host, getMarkdown: () => handle.current!.getMarkdown(), editor: () => editorRef.current! };
}

describe('withPageLook', () => {
  it('maps each page-look key to its component (over the configured one) and leaves other plugins alone', () => {
    const plugins = withPageLook(CoreKit);
    expect(plugins).toHaveLength(CoreKit.length);
    const editor = createPlateEditor({ plugins });
    const component = (key: string) => editor.getPlugin({ key }).render.node;
    expect(component(KEYS.p)).toBe(PageParagraphElement);
    expect(component(KEYS.h2)).toBe(PageH2Element);
    expect(component(KEYS.callout)).toBe(PageCalloutElement);
    expect(component(DOCS_KEYS.tabs)).toBe(PageTabsElement);
    const untouched = CoreKit.find((p) => !(p.key in PAGE_LOOK_COMPONENTS))!;
    expect(plugins.find((p) => p.key === untouched.key)).toBe(untouched);
  });

  it('does not change the input list', () => {
    const before = createPlateEditor({ plugins: CoreKit });
    withPageLook(CoreKit);
    const after = createPlateEditor({ plugins: CoreKit });
    expect(after.getPlugin({ key: KEYS.h2 }).render.node).toBe(before.getPlugin({ key: KEYS.h2 }).render.node);
    expect(after.getPlugin({ key: KEYS.h2 }).render.node).not.toBe(PageH2Element);
  });
});

describe('page look', () => {
  it('renders headings and paragraphs as bare elements (the page styles them)', async () => {
    const m = await mount('\n## Section\n\nSome text.\n');
    const h2 = m.host.querySelector('[data-slate-editor] h2')!;
    expect(h2.textContent).toBe('Section');
    expect(h2.className.split(' ').filter((c) => !c.startsWith('slate-'))).toEqual([]);
    expect(m.host.querySelector('[data-slate-editor] p')!.textContent).toBe('Some text.');
  });

  it('renders an admonition with the injected component and saves it unchanged', async () => {
    const md = '\n:::tip[Pro tip]\n\nKeep it short.\n\n:::\n';
    const m = await mount(md, { skin: { Admonition: FakeAdmonition } });
    const adm = m.host.querySelector('.theme-admonition-tip')!;
    expect(adm).not.toBeNull();
    expect(adm.querySelector('.admonitionHeading')!.textContent).toContain('Pro tip');
    expect(adm.querySelector('.admonitionHeading')!.getAttribute('contenteditable')).toBe('false');
    expect(adm.querySelector('.admonitionContent [data-slate-node]')).not.toBeNull();
    expect(m.getMarkdown()).toBe(md);
  });

  it('falls back to the editor callout without a skin', async () => {
    const m = await mount('\n:::note\n\nPlain.\n\n:::\n');
    expect(m.host.querySelector('.theme-admonition')).toBeNull();
    expect(m.host.textContent).toContain('note');
  });

  it('renders Tabs with the Infima markup, one panel at a time', async () => {
    const md = '\n<Tabs>\n  <TabItem value="a" label="Alpha">\n    First.\n  </TabItem>\n  <TabItem value="b" label="Beta">\n    Second.\n  </TabItem>\n</Tabs>\n';
    const m = await mount(md);
    const tabs = [...m.host.querySelectorAll<HTMLElement>('.tabs-container ul.tabs > li.tabs__item')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Alpha', 'Beta']);
    expect(tabs[0]!.classList.contains('tabs__item--active')).toBe(true);
    const panels = [...m.host.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(panels.map((p) => p.hidden)).toEqual([false, true]);
    await act(async () => { tabs[1]!.click(); });
    expect([...m.host.querySelectorAll<HTMLElement>('[role="tabpanel"]')].map((p) => p.hidden)).toEqual([true, false]);
    expect(m.host.querySelector('.tabs__item--active')!.textContent).toBe('Beta');
    await act(async () => { tabs[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(m.host.querySelector<HTMLInputElement>('input[aria-label="TabItem label"]')!.value).toBe('Beta');
  });

  it('shows the viewer at the page height with its props behind a settings button', async () => {
    const m = await mount('\n<ModelViewer src="/models/cube.gltf" height={300} />\n');
    for (let i = 0; i < 50 && !m.host.querySelector('[data-testid="model-preview"]'); i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const preview = m.host.querySelector('[data-testid="model-preview"]')!;
    expect(preview.getAttribute('data-src')).toBe('/Base/models/cube.gltf');
    expect(preview.getAttribute('data-height')).toBe('300');
    expect(m.host.querySelector('button[aria-label="ModelViewer settings"]')).not.toBeNull();
    expect(m.host.querySelector('input[aria-label="ModelViewer height"]')).toBeNull(); // only inside the popover
  });

  it('renders the generated okf block read-only and writes it back byte for byte', async () => {
    const md = '\nIntro.\n\n<!-- okf:index -->\n## Pages\n* [Inventory](inventory.md) - Items.\n<!-- /okf:index -->\n';
    const m = await mount(md);
    const block = m.host.querySelector('[data-testid="okf-generated"]')!;
    expect(block.closest('[contenteditable="false"]')).not.toBeNull();
    expect(block.querySelector('h2')!.textContent).toBe('Pages');
    expect(block.querySelector('a')!.getAttribute('href')).toBe('inventory.md');
    expect(m.getMarkdown()).toBe(md);
  });
});

describe('okfInnerMarkdown', () => {
  it('drops the marker comments', () => {
    expect(okfInnerMarkdown('<!-- okf:index -->\n## Pages\n* a\n<!-- /okf:index -->')).toBe('## Pages\n* a');
  });
});
