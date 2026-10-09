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
