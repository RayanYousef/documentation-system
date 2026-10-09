// NavigationGuard on top of the site's router (react-router v5 history.block): in-site link clicks ask
// before leaving a page with unsaved edits.
import type { NavigationGuard } from '@platform/editor/inplace';

interface BlockableHistory { block(prompt: string): () => void }

export function createNavigationGuard(history: BlockableHistory): NavigationGuard {
  return { block: (message) => history.block(message) };
}
