// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ContentBackend, Identity, Session } from '@platform/contracts';
import type { Platform } from '../composition/createPlatform.js';
import { DEFAULT_COMPONENTS } from '../mdx/componentsManifest.js';
import { PlatformContext, type PlatformSession } from '../PlatformContext.js';
import type { RichTextEditorProps, RichTextHandle } from '../richtext/index.js';
import { BodyEditor } from './BodyEditor.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The editor itself is tested in src/richtext; here only the props BodyEditor passes through matter.
const seen: RichTextEditorProps[] = [];
vi.mock('../richtext/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../richtext/index.js')>()),
  RichTextEditor: (props: RichTextEditorProps) => { seen.push(props); return <div data-testid="rich-text" />; },
}));

const platform = { config: { baseUrl: '/Base/', codeRepos: [] } } as unknown as Platform;
const backend = {} as ContentBackend;
const identity: Identity = { login: 'ray', name: 'Ray', email: null, role: 'editor' };
const session = { kind: 'mock' } as unknown as Session;
/** App builds the context value inline, so every App render gives a new object with the same members. */
const ctx = (): PlatformSession => ({ platform, session, identity, backend, logout: () => {} });

const roots: Root[] = [];
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); seen.length = 0; });

describe('BodyEditor', () => {
  it('passes the body, flags and callbacks to the rich text editor', async () => {
    const root = createRoot(document.createElement('div'));
    roots.push(root);
    const onChange = vi.fn();
    const onParseError = vi.fn();
    const ref = createRef<RichTextHandle>();
    await act(async () => root.render(
      <PlatformContext.Provider value={ctx()}>
        <BodyEditor markdown={'\nBody.\n'} editorRef={ref} fileLabel="a.md" components={DEFAULT_COMPONENTS} readOnly onChange={onChange} onParseError={onParseError} />
      </PlatformContext.Provider>,
    ));
    const props = seen.at(-1)!;
    expect(props).toMatchObject({ markdown: '\nBody.\n', readOnly: true, components: DEFAULT_COMPONENTS, onChange, onParseError, ref });
    expect(props.services.baseUrl).toBe('/Base/');
  });

  it('keeps the same services across App renders, and builds new ones for another page', async () => {
    const root = createRoot(document.createElement('div'));
    roots.push(root);
    const render = (fileLabel: string) => act(async () => root.render(
      <PlatformContext.Provider value={ctx()}>
        <BodyEditor markdown="" editorRef={createRef()} fileLabel={fileLabel} components={DEFAULT_COMPONENTS} readOnly={false} onChange={() => {}} onParseError={() => {}} />
      </PlatformContext.Provider>,
    ));
    await render('a.md');
    await render('a.md');
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.at(-1)!.services).toBe(seen[0]!.services);
    await render('b.md');
    expect(seen.at(-1)!.services).not.toBe(seen[0]!.services);
  });
});
