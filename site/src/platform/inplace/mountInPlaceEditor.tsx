// Entry of the lazy "inplace-editor" chunk (loaded on the first Edit, or to show a pending save).
// Builds the InPlaceHost for this page from Docusaurus (router, site config, plugin global data) and
// mounts the editor library with the site's skin. The editor stylesheet is injected while anything from
// this chunk is mounted and removed afterwards. The server build replaces this module with a stub
// (site/plugins/platform-inplace-edit/serverStub.tsx).
import React, { useEffect, useState } from 'react';
import { useHistory } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { usePluginData } from '@docusaurus/useGlobalData';
import type { PlatformConfig } from '@platform/contracts';
import { InPlaceEditor, SavedPreview, pendingEdits, type EditablePage, type InPlaceExit, type InPlaceHost } from '@platform/editor/inplace';
import platform from '../../../../platform.config.js';
import { resetContentBackend } from '../createContentBackend';
import { createInPlaceHost, type InPlaceGlobalData } from './createInPlaceHost';
import { useEditorStylesheet } from './editorStylesheet';
import { createNavigationGuard } from './navigationGuard';
import { siteSkin } from './skin';

function useInPlaceHost(): InPlaceHost | null {
  const history = useHistory();
  const { siteConfig } = useDocusaurusContext();
  const global = usePluginData('platform-inplace-edit') as InPlaceGlobalData;
  const [host, setHost] = useState<InPlaceHost | null>(null);
  useEffect(() => {
    let alive = true;
    void createInPlaceHost({
      config: platform as PlatformConfig,
      global,
      buildSha: String(siteConfig.customFields?.['buildSha'] ?? 'local'),
      navigation: createNavigationGuard(history),
      navigate: (url) => history.push(url),
      onSignedIn: resetContentBackend,
    }).then((h) => { if (alive) setHost(h); });
    return () => { alive = false; };
  }, [history, global, siteConfig]);
  return host;
}

const Loading = () => <p className="ped-loading" style={{ fontStyle: 'italic', opacity: 0.8 }}>Loading the editor...</p>;

export default function InPlaceEditorMount({ page, onExit }: { page: EditablePage; onExit(result: InPlaceExit): void }) {
  useEditorStylesheet();
  const host = useInPlaceHost();
  if (!host) return <Loading />;
  return <InPlaceEditor host={host} page={page} skin={siteSkin} onExit={onExit} />;
}

export interface SavedPreviewMountProps {
  page: EditablePage;
  /** The just-saved file; when absent, the tab's pending edit for the page (if it is still pending). */
  saved?: { text: string; commitSha: string; commitUrl: string | null };
  /** Nothing (or nothing current) to show: the site shows the built page again. */
  onGone(): void;
}

export function SavedPreviewMount({ page, saved, onGone }: SavedPreviewMountProps) {
  useEditorStylesheet();
  const host = useInPlaceHost();
  const pending = !saved && host ? pendingEdits.get(page.path, host.buildSha) : null;
  const shown = saved ?? pending;
  useEffect(() => { if (host && !shown) onGone(); }, [host, shown, onGone]);
  if (!host || !shown) return null;
  return <SavedPreview host={host} page={page} text={shown.text} commitSha={shown.commitSha} commitUrl={shown.commitUrl} skin={siteSkin} />;
}
