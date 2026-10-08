/**
 * The rich text editor seam. The app only knows this interface: a Markdown body goes in, a Markdown body
 * comes out (pulled through the handle). The Plate implementation lives in ./plate; a later editor is a
 * new sibling folder, and only ./index.ts changes.
 */
import type { ReactElement, Ref } from 'react';
import type { AssetInfo, ComponentsManifest } from '@platform/contracts';

/** Pulled by App on save and on Visual -> Raw. */
export interface RichTextHandle {
  /** The body as Markdown. Returns the loaded `markdown` byte for byte when the content was not changed. */
  getMarkdown(): string;
}

/** Same shape the previous editor's onError used, so App's handler stays the same. */
export interface RichTextParseError { error: string; source: string }

/** Platform services the editor needs. Built by createRichTextServices; editors never call usePlatform(). */
export interface RichTextServices {
  /** Site base URL, for example "/documentation-system/". */
  baseUrl: string;
  /** Commits uploads/<name>. Resolves { src: `${baseUrl}${asset.url.slice(1)}`, alt: name }. */
  uploadImage(file: File): Promise<{ src: string; alt: string }>;
  /** Commits models/<name> or models/fbx/<name>. Resolves { component, src: `/${assetPath}`, alt: name }. */
  uploadModel(file: File): Promise<{ component: 'ModelViewer' | 'FbxViewer'; src: string; alt: string }>;
  /** Assets already committed to the site. Cached per services instance; a failure clears the cache. */
  listAssets(): Promise<AssetInfo[]>;
  /** File from a code repo, for viewer previews. */
  getAsset(ref: { repo: string; ref: string; path: string }): Promise<Blob>;
  /** codeRepos[].defaultRef for "owner/repo", else 'main'. */
  defaultRef(repo: string): string;
}

export interface RichTextEditorProps {
  /** Page body only (no frontmatter). Usually starts with "\n". */
  markdown: string;
  readOnly: boolean;
  components: ComponentsManifest;
  services: RichTextServices;
  /** Called (once per mount) when the exported Markdown first differs from the loaded baseline. Never on mount, never after a save remount. */
  onChange(): void;
  /** Called once, after mount, when the body cannot be imported safely. The editor then renders nothing. */
  onParseError(e: RichTextParseError): void;
  /** React 19 ref prop. */
  ref?: Ref<RichTextHandle>;
}

export type RichTextEditorComponent = (props: RichTextEditorProps) => ReactElement | null;
