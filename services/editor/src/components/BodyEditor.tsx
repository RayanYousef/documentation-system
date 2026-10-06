import { useMemo, type Ref } from 'react';
import type { ComponentsManifest } from '@platform/contracts';
import { usePlatform } from '../PlatformContext.js';
import { RichTextEditor, createRichTextServices, type RichTextHandle, type RichTextParseError } from '../richtext/index.js';

/** The page body in the rich text editor. The editor gets platform services as props, built once per page. */
export function BodyEditor({ markdown, editorRef, fileLabel, components, readOnly, onChange, onParseError }: { markdown: string; editorRef: Ref<RichTextHandle>; fileLabel: string; components: ComponentsManifest; readOnly: boolean; onChange(): void; onParseError(e: RichTextParseError): void }) {
  const { platform, backend, identity } = usePlatform();
  // App builds the context value inline, so memoize on its members, not on the object.
  const services = useMemo(() => createRichTextServices({ platform, backend, identity }, fileLabel), [platform, backend, identity, fileLabel]);
  return <RichTextEditor ref={editorRef} markdown={markdown} readOnly={readOnly} components={components} services={services} onChange={onChange} onParseError={onParseError} />;
}
