// How some blocks look, supplied by the page the editor is mounted in (dependency inversion: the editor
// never imports the site). The site composition root injects the site's own components, so an
// admonition being edited is the same component readers see. Without a skin the editor falls back to
// its own look.
import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

export interface RichTextSkin {
  /** Renders an admonition (:::note, :::tip, ...). `children` are the editable blocks. */
  Admonition?: ComponentType<{ type: string; title?: ReactNode; children: ReactNode }>;
}

const SkinContext = createContext<RichTextSkin>({});

export function RichTextSkinProvider({ skin, children }: { skin: RichTextSkin; children: ReactNode }) {
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}

export const useRichTextSkin = (): RichTextSkin => useContext(SkinContext);
