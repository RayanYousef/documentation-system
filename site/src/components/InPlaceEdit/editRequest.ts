// "Edit this page" in the doc footer and the Edit button above the content start the same in-place
// editor; the footer link reaches the content wrapper through this tiny emitter.
type Listener = () => void;
const listeners = new Set<Listener>();

export function requestEdit(): void {
  for (const l of listeners) l();
}

export function onEditRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** A message from the editor that must survive the navigation it caused (delete, rename, new page). */
let flash: string | null = null;
export function setFlashNotice(message: string | null): void {
  flash = message;
  // Only for the navigation the exit starts right away; never shown on a later, unrelated page.
  if (message) setTimeout(() => { if (flash === message) flash = null; }, 3000);
}
export function takeFlashNotice(): string | null { const m = flash; flash = null; return m; }
