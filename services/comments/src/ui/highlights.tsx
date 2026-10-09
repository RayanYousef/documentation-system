// Paints the commented text without touching the page's DOM: the CSS Custom Highlight API where the browser
// has it, otherwise absolutely positioned boxes in a layer of their own over the text. Hit-testing (hover and
// click) works on the ranges' client rects either way.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const NAME = 'platform-comment';
const ACTIVE = 'platform-comment-active';

interface HighlightLike { new (...ranges: Range[]): unknown }
interface Registry { set(name: string, h: unknown): void; delete(name: string): void }
const registry = (): Registry | null => {
  const css = (globalThis as unknown as { CSS?: { highlights?: Registry } }).CSS;
  return css?.highlights && typeof (globalThis as { Highlight?: unknown }).Highlight === 'function' ? css.highlights : null;
};

export const supportsHighlights = (): boolean => registry() !== null;

/** Paints `ranges` (and `active` stronger) with the Highlight API; the returned function removes them. */
export function paintHighlights(ranges: Range[], active: Range | null): () => void {
  const reg = registry();
  if (!reg) return () => {};
  const H = (globalThis as unknown as { Highlight: HighlightLike }).Highlight;
  reg.set(NAME, new H(...ranges));
  if (active) reg.set(ACTIVE, new H(active)); else reg.delete(ACTIVE);
  return () => { reg.delete(NAME); reg.delete(ACTIVE); };
}

/** The point is on the range's text. */
export function rangeContains(range: Range, x: number, y: number): boolean {
  for (const r of Array.from(range.getClientRects())) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
  return false;
}

interface Box { left: number; top: number; width: number; height: number; active: boolean }

/** Fallback for browsers without the Highlight API: boxes over the text, redrawn when the layout changes. */
export function FallbackMarks({ ranges, active, version }: { ranges: Range[]; active: Range | null; version: number }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    const draw = () => {
      const out: Box[] = [];
      for (const range of ranges) {
        for (const r of Array.from(range.getClientRects())) {
          if (r.width && r.height) out.push({ left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height, active: range === active });
        }
      }
      setBoxes(out);
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [ranges, active, version]);
  return createPortal(
    <div data-comments-ignore="" aria-hidden="true">
      {boxes.map((b, i) => <div key={i} className={`pc-mark${b.active ? ' pc-mark--active' : ''}`} style={{ left: b.left, top: b.top, width: b.width, height: b.height }} />)}
    </div>,
    document.body,
  );
}
