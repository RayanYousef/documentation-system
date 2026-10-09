// The in-place editor library: the only entry the site's composition root imports (lazily, on Edit).
// It exports components and contract-typed ports; it never imports an implementation of them.
export { InPlaceEditor, type InPlaceEditorProps, type InPlaceExit, type SavedResult } from './InPlaceEditor.js';
export { SavedPreview, type SavedPreviewProps } from './SavedPreview.js';
export { pendingEdits, createPendingEdits, PENDING_TTL_MS, type PendingEdit, type PendingEdits } from './pendingEdits.js';
export { SIGN_IN_PANELS, type SignInPanel } from './signInPanels.js';
export { DISCARD_PROMPT } from './useUnsavedGuard.js';
export type { EditMode, EditablePage, InPlaceHost, NavigationGuard, SessionStore } from '../host.js';
export type { RichTextSkin } from '../richtext/skin.js';
export { BrowserSessionStore, SESSION_STORAGE_KEY } from '../session/SessionStore.js';
/** The editor stylesheet as a string: inject it while editing, remove it afterwards. */
export { default as inplaceCss } from '../theme-inpage/inplace.pcss';
