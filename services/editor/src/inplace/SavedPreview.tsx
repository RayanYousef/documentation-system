// After a save, the page shows the saved document (read-only, in the page look) until the site itself
// catches up: on the live site until the deploy carries the commit, on the dev server until Docusaurus
// hot-reloads the file. The banner says which.
import { useEffect, useMemo, useState } from 'react';
import type { ComponentsManifest, Identity } from '@platform/contracts';
import type { EditablePage, InPlaceHost } from '../host.js';
import { readFields, splitDocument } from '../frontmatter/yamlDoc.js';
import { DEFAULT_COMPONENTS, loadComponentsManifest } from '../mdx/componentsManifest.js';
import { RichTextEditor, createRichTextServices } from '../richtext/index.js';
import { RichTextSkinProvider, type RichTextSkin } from '../richtext/skin.js';

export interface SavedPreviewProps {
  host: InPlaceHost;
  page: EditablePage;
  text: string;
  commitSha: string;
  commitUrl: string | null;
  skin?: RichTextSkin;
}

/** Read-only previews never upload; the identity only satisfies the services' shape. */
const READER: Identity = { name: '', login: 'reader', email: null, role: 'viewer' };

export function SavedPreview({ host, page, text, commitSha, commitUrl, skin }: SavedPreviewProps) {
  const [components, setComponents] = useState<ComponentsManifest>(DEFAULT_COMPONENTS);
  useEffect(() => { void loadComponentsManifest(host.componentsUrl).then(setComponents); }, [host.componentsUrl]);
  const services = useMemo(() => createRichTextServices({ host, backend: host.backend(host.sessionStore.load()), identity: READER }, page.path), [host, page.path]);
  const { head, body } = splitDocument(text);
  const title = readFields(head).title;
  const [failed, setFailed] = useState(false);
  const url = commitUrl ?? (commitSha ? host.urls.commitUrl(commitSha) : null);
  return (
    <RichTextSkinProvider skin={skin ?? {}}>
      <div className="ped-ui" data-platform-saved-preview="">
        <p className="ped-banner ped-chrome" role="status" data-testid="saved-banner">
          {host.mode === 'local-disk'
            ? <>Saved to disk. The page reloads when the dev server picks up the change; commit it with git when you are ready.</>
            : <>Saved as <code>{commitSha.slice(0, 7)}</code>{url ? <> (<a href={url} target="_blank" rel="noreferrer">view commit</a>)</> : null}. The public site updates after the deploy finishes (usually a few minutes); until then this tab shows your saved version.</>}
        </p>
        <div className="theme-doc-markdown markdown">
          {title && !/^\s*#\s/.test(body) && <header><h1>{title}</h1></header>}
          {failed
            ? <pre className="ped-pre">{body}</pre>
            : <RichTextEditor key={text} markdown={body} readOnly components={components} services={services} onChange={() => {}} onParseError={() => setFailed(true)} />}
        </div>
      </div>
    </RichTextSkinProvider>
  );
}
