// The comments UI's stylesheet, injected as <style data-platform-comments> while the layer is mounted (it is
// part of the lazy comments chunk, never of the site's global CSS). Colours come from Infima variables, so
// light and dark mode follow the site.
import { useLayoutEffect } from 'react';

export const COMMENTS_CSS = `
::highlight(platform-comment) { background-color: rgba(255, 196, 0, 0.32); text-decoration: underline dotted rgba(200, 140, 0, 0.9); }
::highlight(platform-comment-active) { background-color: rgba(255, 170, 0, 0.62); }
[data-theme='dark'] ::highlight(platform-comment) { background-color: rgba(255, 196, 0, 0.24); text-decoration-color: rgba(255, 210, 90, 0.9); }
[data-theme='dark'] ::highlight(platform-comment-active) { background-color: rgba(255, 190, 40, 0.45); }
.pc-mark { position: absolute; pointer-events: none; background: rgba(255, 196, 0, 0.32); mix-blend-mode: multiply; border-radius: 2px; }
[data-theme='dark'] .pc-mark { mix-blend-mode: screen; background: rgba(255, 196, 0, 0.22); }
.pc-mark--active { background: rgba(255, 170, 0, 0.62); }
.pc-pop { position: absolute; z-index: 195; width: 340px; max-width: calc(100vw - 16px); box-sizing: border-box; padding: 0.75rem;
  background: var(--ifm-background-surface-color); color: var(--ifm-font-color-base); border: 1px solid var(--ifm-color-emphasis-300);
  border-radius: var(--ifm-global-radius); box-shadow: var(--ifm-global-shadow-md); font-size: 0.875rem; line-height: 1.45; }
.pc-pop--hover { z-index: 196; pointer-events: none; width: 300px; }
.pc-selbtn { position: absolute; z-index: 194; }
.pc-entry + .pc-entry { margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid var(--ifm-color-emphasis-200); }
.pc-meta { display: flex; gap: 0.4rem; align-items: baseline; flex-wrap: wrap; font-size: 0.78rem; color: var(--ifm-color-emphasis-700); }
.pc-meta strong { color: var(--ifm-font-color-base); font-size: 0.85rem; }
.pc-body { margin: 0.2rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.pc-clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.pc-quote { margin: 0 0 0.5rem; padding-left: 0.5rem; border-left: 3px solid rgba(255, 180, 0, 0.8); font-style: italic; color: var(--ifm-color-emphasis-800); overflow-wrap: anywhere; }
.pc-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; align-items: center; }
.pc-pop textarea, .pc-panel textarea { box-sizing: border-box; width: 100%; min-height: 4.5rem; margin-top: 0.5rem; padding: 0.4rem 0.5rem; resize: vertical;
  font: inherit; color: var(--ifm-font-color-base); background: var(--ifm-background-color); border: 1px solid var(--ifm-color-emphasis-400); border-radius: var(--ifm-global-radius); }
.pc-error { margin: 0.5rem 0 0; color: var(--ifm-color-danger-dark); font-weight: 600; }
[data-theme='dark'] .pc-error { color: var(--ifm-color-danger-light); }
.pc-x { margin-left: auto; padding: 0 0.35rem; border: 0; background: none; color: inherit; font-size: 1.1rem; line-height: 1; cursor: pointer; }
.pc-count { display: inline-block; min-width: 1.3em; margin-left: 0.35rem; padding: 0 0.35em; border-radius: 999px; font-size: 0.75em; line-height: 1.5;
  background: var(--ifm-color-primary); color: var(--ifm-color-primary-contrast-background, #fff); text-align: center; }
.pc-panel { position: fixed; z-index: 190; top: var(--ifm-navbar-height); right: 0; bottom: 0; width: 360px; max-width: 100vw; box-sizing: border-box;
  display: flex; flex-direction: column; background: var(--ifm-background-surface-color); color: var(--ifm-font-color-base);
  border-left: 1px solid var(--ifm-color-emphasis-300); box-shadow: var(--ifm-global-shadow-md); font-size: 0.875rem; }
.pc-panel-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem 0.25rem; }
.pc-panel-head h2 { margin: 0; font-size: 1.05rem; }
.pc-tabs { display: flex; gap: 0.25rem; padding: 0 1rem; border-bottom: 1px solid var(--ifm-color-emphasis-300); }
.pc-tabs button { padding: 0.45rem 0.6rem; border: 0; border-bottom: 2px solid transparent; background: none; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
.pc-tabs button[aria-selected='true'] { border-bottom-color: var(--ifm-color-primary); color: var(--ifm-color-primary); }
.pc-panel-body { flex: 1; overflow-y: auto; padding: 0.75rem 1rem 1rem; }
.pc-panel-body h3 { margin: 1rem 0 0.25rem; font-size: 0.9rem; }
.pc-panel-body > p { color: var(--ifm-color-emphasis-700); }
.pc-item { margin: 0 0 0.75rem; padding: 0.6rem 0.7rem; border: 1px solid var(--ifm-color-emphasis-300); border-radius: var(--ifm-global-radius); }
.pc-item-open { display: block; width: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.pc-tabname { font-size: 0.75rem; color: var(--ifm-color-emphasis-700); }
.pc-confirm { margin-top: 0.5rem; padding: 0.5rem; border-radius: var(--ifm-global-radius); background: var(--ifm-color-danger-contrast-background); color: var(--ifm-color-danger-contrast-foreground); }
.tabs__item[data-comment-count]::after { content: attr(data-comment-count); display: inline-block; min-width: 1.4em; margin-left: 0.4rem; padding: 0 0.35em;
  border-radius: 999px; font-size: 0.7rem; line-height: 1.5; font-weight: 700; vertical-align: middle; text-align: center;
  background: rgba(255, 180, 0, 0.9); color: #2b1d00; }
`;

let users = 0;
let el: HTMLStyleElement | null = null;

/** Adds the stylesheet while at least one comments layer is mounted. */
export function useCommentStyles(): void {
  useLayoutEffect(() => {
    users += 1;
    if (!el) {
      el = document.createElement('style');
      el.setAttribute('data-platform-comments', '');
      el.textContent = COMMENTS_CSS;
      document.head.appendChild(el);
    }
    return () => {
      users -= 1;
      if (users === 0) { el?.remove(); el = null; }
    };
  }, []);
}
