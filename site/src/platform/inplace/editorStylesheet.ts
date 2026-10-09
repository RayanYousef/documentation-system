// The editor stylesheet (<style data-platform-editor>) is injected while anything that uses it is mounted, the
// editor, the saved preview or a sign-in dialog opened for a comment, and removed when the last one unmounts.
import { useLayoutEffect } from 'react';
import inplaceCss from '@platform/editor/inplace/styles.pcss';

let styleUsers = 0;
let styleEl: HTMLStyleElement | null = null;

/** Adds <style data-platform-editor> before the first paint of an editor view; the last unmount removes it. */
export function useEditorStylesheet(): void {
  useLayoutEffect(() => {
    styleUsers += 1;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-platform-editor', '');
      styleEl.textContent = inplaceCss;
      document.head.appendChild(styleEl);
    }
    return () => {
      styleUsers -= 1;
      if (styleUsers === 0) { styleEl?.remove(); styleEl = null; }
    };
  }, []);
}
