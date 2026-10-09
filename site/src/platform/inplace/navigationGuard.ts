// NavigationGuard on top of the site's router (react-router v5 history.block): in-site link clicks to
// another page ask before leaving a page with unsaved edits. Jumps within the page (table of contents,
// heading anchors) do not ask: nothing is discarded by them.
import type { NavigationGuard } from '@platform/editor/inplace';

/** history v4's transition prompt: false blocks the navigation, undefined lets it through. */
type TransitionPrompt = (location: { pathname: string }, action: string) => false | void;
interface BlockableHistory { location: { pathname: string }; block(prompt: TransitionPrompt): () => void }

export function createNavigationGuard(history: BlockableHistory): NavigationGuard {
  return {
    block: (message, onLeave) => {
      const from = history.location.pathname;
      return history.block((location) => {
        if (location.pathname === from) return undefined;
        if (!window.confirm(message)) return false;
        onLeave?.();
        return undefined;
      });
    },
  };
}
