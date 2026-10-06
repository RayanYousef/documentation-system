// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Plate, PlateContent, createPlateEditor, type PlateEditor } from 'platejs/react';
import type { AssetInfo } from '@platform/contracts';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { UnsupportedFileError } from '../../assets.js';
import type { RichTextServices } from '../../RichTextEditor.js';
import { DocsEditorProvider } from '../context.js';
import { ContentKit } from '../kits/content-kit.js';
import { buildDocsMarkdown, exportBody } from '../markdown/docsMarkdown.js';
import { Toolbar } from '../ui/toolbar.js';
import { TooltipProvider } from '../ui/tooltip.js';
import { InsertComponentMenu } from './InsertComponentMenu.js';
import { InsertFromRepoButton } from './InsertFromRepoButton.js';
import { InsertImageButton } from './InsertImageButton.js';
import { InsertImageUrlButton } from './InsertImageUrlButton.js';
import { InsertModelButton } from './InsertModelButton.js';
import { InsertTabsButton } from './InsertTabsButton.js';

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

const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
const ASSETS: AssetInfo[] = [
  { path: 'models/fbx/Air.fbx', url: '/models/fbx/Air.fbx', size: 1, kind: 'model' },
  { path: 'uploads/x.png', url: '/uploads/x.png', size: 1, kind: 'image' },
];

function fakeServices(over: Partial<RichTextServices> = {}): RichTextServices {
  return {
    baseUrl: '/Base/',
    uploadImage: vi.fn(async (f: File) => ({ src: `/Base/uploads/${f.name}`, alt: f.name })),
    uploadModel: vi.fn(async (f: File) => ({ component: 'ModelViewer' as const, src: `/models/${f.name}`, alt: f.name })),
    listAssets: vi.fn(async () => ASSETS),
    getAsset: vi.fn(async () => new Blob()),
    defaultRef: () => 'main',
    ...over,
  };
}

const roots: Root[] = [];
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

async function mount(services = fakeServices()) {
  const editor: PlateEditor = createPlateEditor({ plugins: ContentKit, value: [{ type: 'p', children: [{ text: 'Intro.' }] }] });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(
    <DocsEditorProvider services={services} components={DEFAULT_COMPONENTS}>
      <Plate editor={editor}>
        <TooltipProvider>
          <Toolbar data-testid="toolbar">
            <InsertImageUrlButton />
            <InsertImageButton />
            <InsertModelButton />
            <InsertFromRepoButton />
            <InsertTabsButton />
            <InsertComponentMenu />
          </Toolbar>
        </TooltipProvider>
        <PlateContent />
      </Plate>
    </DocsEditorProvider>,
  ));
  await act(async () => { editor.tf.select(editor.api.end([0])); });
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const fileInput = (accept: string) => host.querySelector<HTMLInputElement>(`input[type=file][accept="${accept}"]`)!;
  return { host, editor, services, button, fileInput, out: () => exportBody(editor, editor.children, '*', md) };
}

async function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });

describe('insert toolbar buttons', () => {
  it('keeps the old titles as accessible names', async () => {
    const m = await mount();
    for (const label of ['Upload image', 'Insert 3D model (.glb, .gltf, .fbx)', 'Insert from repo (existing models and images)', 'Insert tabs', 'Insert image by URL', 'Insert component']) {
      expect(m.button(label), label).not.toBeNull();
    }
  });

  it('uploads a model and inserts its viewer', async () => {
    const m = await mount();
    await chooseFile(m.fileInput('.glb,.gltf,.fbx'), new File(['x'], 'ship.glb'));
    expect(m.services.uploadModel).toHaveBeenCalledTimes(1);
    expect(m.out()).toBe('Intro.\n\n<ModelViewer src="/models/ship.glb" alt="ship.glb" />\n');
  });

  it('shows "Uploading model..." while the upload runs', async () => {
    type Uploaded = Awaited<ReturnType<RichTextServices['uploadModel']>>;
    let finish: (v: Uploaded) => void = () => {};
    const m = await mount(fakeServices({ uploadModel: vi.fn(() => new Promise<Uploaded>((r) => { finish = r; })) }));
    await chooseFile(m.fileInput('.glb,.gltf,.fbx'), new File(['x'], 'a.fbx'));
    expect(m.button('Uploading model...')?.disabled).toBe(true);
    await act(async () => finish({ component: 'FbxViewer', src: '/models/fbx/a.fbx', alt: 'a.fbx' }));
    expect(m.button('Insert 3D model (.glb, .gltf, .fbx)')).not.toBeNull();
    expect(m.out()).toBe('Intro.\n\n<FbxViewer src="/models/fbx/a.fbx" alt="a.fbx" />\n');
  });

  it('alerts the old messages when a model cannot be inserted', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const msg = 'Unsupported 3D model type ".obj". Use .glb, .gltf or .fbx.';
    const m = await mount(fakeServices({ uploadModel: vi.fn().mockRejectedValueOnce(new UnsupportedFileError(msg)).mockRejectedValueOnce(new Error('boom')) }));
    await chooseFile(m.fileInput('.glb,.gltf,.fbx'), new File(['x'], 'a.obj'));
    await chooseFile(m.fileInput('.glb,.gltf,.fbx'), new File(['x'], 'a.glb'));
    expect(alert.mock.calls).toEqual([[msg], ['Could not insert 3D model: boom']]);
    expect(m.out()).toBe('Intro.\n');
  });

  it('uploads an image and inserts it, or alerts', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const m = await mount();
    await chooseFile(m.fileInput('image/*'), new File(['x'], 'x.png'));
    expect(m.out()).toBe('Intro.\n\n![x.png](/Base/uploads/x.png)\n');
    vi.mocked(m.services.uploadImage).mockRejectedValueOnce(new UnsupportedFileError('Unsupported image type.')).mockRejectedValueOnce(new Error('offline'));
    await chooseFile(m.fileInput('image/*'), new File(['x'], 'x.txt'));
    await chooseFile(m.fileInput('image/*'), new File(['x'], 'y.png'));
    expect(alert.mock.calls).toEqual([['Unsupported image type.'], ['Could not upload image: offline']]);
  });

  it('picks a repo asset from a modal on <body> and lists assets once', async () => {
    const m = await mount();
    await click(m.button('Insert from repo (existing models and images)'));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(m.host.contains(dialog)).toBe(false);
    expect(m.host.querySelector('[data-testid="toolbar"]')!.contains(dialog)).toBe(false);
    await click([...dialog.querySelectorAll('button')].find((b) => b.textContent === 'model: models/fbx/Air.fbx')!);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await click(m.button('Insert from repo (existing models and images)'));
    await click([...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'image: uploads/x.png')!);
    expect(m.services.listAssets).toHaveBeenCalledTimes(1);
    expect(m.out()).toBe('Intro.\n\n<FbxViewer src="/models/fbx/Air.fbx" alt="Air.fbx" />\n\n![uploads/x.png](/Base/uploads/x.png)\n');
  });

  it('shows a listing error in the modal', async () => {
    const m = await mount(fakeServices({ listAssets: vi.fn(async () => { throw new Error('nope'); }) }));
    await click(m.button('Insert from repo (existing models and images)'));
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe('Could not list assets: nope');
  });

  it('inserts the two-tab block', async () => {
    const m = await mount();
    await click(m.button('Insert tabs'));
    expect(m.out()).toContain('<Tabs>\n  <TabItem value="one" label="One" default>\n    First tab\n  </TabItem>');
  });

  it('inserts an image by URL from the dialog', async () => {
    const m = await mount();
    await click(m.button('Insert image by URL'));
    const inputs = document.querySelectorAll<HTMLInputElement>('[role="dialog"] input');
    const type = (input: HTMLInputElement, value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await type(inputs[0]!, '/img/a.png');
    await type(inputs[1]!, 'A picture');
    await act(async () => { document.querySelector('[role="dialog"] form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(m.out()).toBe('Intro.\n\n![A picture](/img/a.png)\n');
  });

  it('lists the manifest components and inserts the picked one', async () => {
    const m = await mount();
    const trigger = m.button('Insert component');
    await act(async () => { trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    expect(items.map((i) => i.textContent)).toEqual(['<ModelViewer />', '<FbxViewer />', '<Tabs>', '<TabItem>']);
    await click(items[1]!);
    expect(m.out()).toBe('Intro.\n\n<FbxViewer />\n');
  });
});
