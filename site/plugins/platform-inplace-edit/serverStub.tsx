// Server (SSR) stand-in for site/src/platform/inplace/mountInPlaceEditor.tsx. The plugin swaps the real
// module for this one in the server compile, so Plate and the editor never enter the SSR bundle.
// Editing only ever happens after hydration, so the stub is never rendered with real props.
export default function InPlaceEditorStub(): null {
  return null;
}

export function SavedPreviewMount(): null {
  return null;
}
