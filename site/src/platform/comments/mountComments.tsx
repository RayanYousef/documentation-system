// Entry of the lazy "comments" chunk, mounted next to the Edit button on Latest doc pages (never while
// editing). Builds the CommentsHost from Docusaurus (site config, plugin global data) and mounts the comments
// layer. Signing in and the comment stores come from a second lazy chunk on the first comment action.
import React, { useMemo } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { usePluginData } from '@docusaurus/useGlobalData';
import type { PlatformConfig } from '@platform/contracts';
import { CommentsLayer } from '@platform/comments';
import type { EditablePage } from '@platform/editor/inplace';
import platform from '../../../../platform.config.js';
import { setTabCommentCounts } from '@site/src/components/Comments/tabCommentCounts';
import type { InPlaceGlobalData } from '../inplace/editAccess';
import { createCommentsHost } from './createCommentsHost';

const loadSession = () => import(/* webpackChunkName: "comments-session" */ './commentSession');

export default function CommentsMount({ page }: { page: EditablePage }) {
  const { siteConfig } = useDocusaurusContext();
  const global = usePluginData('platform-inplace-edit') as InPlaceGlobalData;
  const buildSha = String(siteConfig.customFields?.['buildSha'] ?? 'local');
  const host = useMemo(() => createCommentsHost({
    config: platform as PlatformConfig,
    global,
    buildSha,
    signIn: async () => {
      const session = await loadSession();
      return session.obtainCommentEditor({ config: platform as PlatformConfig, global, onSignedIn: session.resetContentBackend });
    },
    signedInEditor: async () => (await loadSession()).currentCommentEditor({ config: platform as PlatformConfig, global }),
    setTabCounts: setTabCommentCounts,
  }), [global, buildSha]);
  return <CommentsLayer host={host} page={page.path} />;
}
