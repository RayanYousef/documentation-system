// What the docs blocks and toolbar buttons need from outside Plate: the platform services and the
// components manifest. PlateRichTextEditor provides it; nothing here calls usePlatform().
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ComponentsManifest } from '@platform/contracts';
import type { RichTextServices } from '../RichTextEditor.js';

export interface DocsEditorContextValue {
  /** null outside an editor (blocks then show what they can without the backend). */
  services: RichTextServices | null;
  components: ComponentsManifest;
}

const DocsEditorContext = createContext<DocsEditorContextValue>({ services: null, components: { components: [] } });

export function DocsEditorProvider({ services, components, children }: { services: RichTextServices | null; components: ComponentsManifest; children: ReactNode }) {
  const value = useMemo(() => ({ services, components }), [services, components]);
  return <DocsEditorContext.Provider value={value}>{children}</DocsEditorContext.Provider>;
}

export const useDocsServices = (): RichTextServices | null => useContext(DocsEditorContext).services;
export const useDocsComponents = (): ComponentsManifest => useContext(DocsEditorContext).components;

/** For the upload and insert buttons, which only make sense inside a full editor. */
export function useRequiredServices(): RichTextServices {
  const services = useDocsServices();
  if (!services) throw new Error('Rich text services missing: render inside DocsEditorProvider.');
  return services;
}
