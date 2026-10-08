import { describe, it, expect } from 'vitest';
import type { ComponentsManifest } from '@platform/contracts';
import { loadComponentsManifest, DEFAULT_COMPONENTS } from './componentsManifest.js';

const json = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('components manifest', () => {
  it('falls back to defaults when the site does not publish one', async () => {
    const f: typeof fetch = async () => new Response(null, { status: 404 });
    expect(await loadComponentsManifest('http://x/platform/components.json', f)).toEqual(DEFAULT_COMPONENTS);
  });
  it('uses the manifest the site publishes', async () => {
    const site: ComponentsManifest = { components: [{ name: 'Callout', kind: 'flow', hasChildren: true, preview: 'generic', props: [{ name: 'tone', type: 'string' }] }] };
    expect(await loadComponentsManifest('http://x/platform/components.json', json(site))).toEqual(site);
  });
  it('falls back to defaults on an empty or malformed manifest, or a network error', async () => {
    expect(await loadComponentsManifest('u', json({ components: [] }))).toEqual(DEFAULT_COMPONENTS);
    expect(await loadComponentsManifest('u', json({ nope: true }))).toEqual(DEFAULT_COMPONENTS);
    expect(await loadComponentsManifest('u', async () => { throw new TypeError('offline'); })).toEqual(DEFAULT_COMPONENTS);
  });
  it('defaults cover the viewers and tabs the docs use, viewers as void blocks and tabs as containers', () => {
    const byName = new Map(DEFAULT_COMPONENTS.components.map((c) => [c.name, c]));
    expect(byName.get('ModelViewer')).toMatchObject({ hasChildren: false, preview: 'model-viewer' });
    expect(byName.get('FbxViewer')).toMatchObject({ hasChildren: false, preview: 'fbx-viewer' });
    expect(byName.get('Tabs')).toMatchObject({ hasChildren: true, preview: 'tabs' });
    expect(byName.get('TabItem')?.props.map((p) => p.name)).toEqual(['value', 'label', 'default']);
  });
});
