import type { ComponentsManifest } from '@platform/contracts';

export const DEFAULT_COMPONENTS: ComponentsManifest = {
  components: [
    { name: 'ModelViewer', kind: 'flow', hasChildren: false, preview: 'model-viewer', props: [{ name: 'src', type: 'string' }, { name: 'repo', type: 'string' }, { name: 'ref', type: 'string' }, { name: 'path', type: 'string' }, { name: 'alt', type: 'string' }, { name: 'height', type: 'number' }] },
    { name: 'FbxViewer', kind: 'flow', hasChildren: false, preview: 'fbx-viewer', props: [{ name: 'src', type: 'string' }, { name: 'repo', type: 'string' }, { name: 'ref', type: 'string' }, { name: 'path', type: 'string' }, { name: 'alt', type: 'string' }, { name: 'height', type: 'number' }] },
    { name: 'Tabs', kind: 'flow', hasChildren: true, preview: 'tabs', props: [{ name: 'groupId', type: 'string' }] },
    { name: 'TabItem', kind: 'flow', hasChildren: true, preview: 'tab-item', props: [{ name: 'value', type: 'string' }, { name: 'label', type: 'string' }, { name: 'default', type: 'boolean' }] },
  ],
};

export async function loadComponentsManifest(url: string, f: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<ComponentsManifest> {
  try {
    const res = await f(url);
    if (!res.ok) return DEFAULT_COMPONENTS;
    const data = (await res.json()) as ComponentsManifest;
    return Array.isArray(data.components) && data.components.length ? data : DEFAULT_COMPONENTS;
  } catch { return DEFAULT_COMPONENTS; }
}
