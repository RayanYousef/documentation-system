// The sign-in dialog on its own (`@platform/editor/signin`), for places that need a signed-in editor without
// loading the whole editor: the comments on a page. It shares the tab's verified sessions with the editor.
// The dialog uses the editor stylesheet (`@platform/editor/inplace/styles.pcss`); inject it while it is shown.
export { SignInDialog, type SignInDialogProps } from '../inplace/SignInDialog.js';
export { SIGN_IN_PANELS, type SignInPanel } from '../inplace/signInPanels.js';
export { rememberVerified, verifiedIdentity, forgetVerifiedSessions } from '../session/verifiedSessions.js';
