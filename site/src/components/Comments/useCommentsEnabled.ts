// Whether comments are on for this site (platform.config.js features.comments, through the platform-comments plugin).
import { usePluginData } from '@docusaurus/useGlobalData';

export function useCommentsEnabled(): boolean {
  const data = usePluginData('platform-comments') as { enabled?: boolean } | undefined;
  return data?.enabled === true;
}
