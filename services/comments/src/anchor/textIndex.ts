// The text of a page's content element as one string (whitespace runs collapsed to one space), with the DOM
// position of every character, so a text span can become a DOM Range and a selection can become a span.
// Read only: nothing in the page's DOM is changed.
import { normalizeSpace, type TextSpan } from './textQuote.js';

/** Elements whose text is never part of a comment: tab labels, buttons, heading anchors, scripts, comment UI. */
export const SKIPPED = '[role="tablist"],button,.hash-link,script,style,noscript,svg,canvas,textarea,input,select,[data-comments-ignore]';

export interface TextIndex {
  root: Element;
  text: string;
  /** DOM position of text[i]. */
  nodes: Text[];
  offsets: number[];
}

const isSpace = (c: string) => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f' || c === ' ';

export function buildTextIndex(root: Element): TextIndex {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 0x1 | 0x4 /* SHOW_ELEMENT | SHOW_TEXT */, {
    acceptNode: (n) => (n.nodeType === 1 && (n as Element).matches(SKIPPED) ? 2 /* FILTER_REJECT */ : 1 /* FILTER_ACCEPT */),
  });
  let text = '';
  const nodes: Text[] = [];
  const offsets: number[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType !== 3) continue;
    const t = n as Text;
    const s = t.data;
    for (let i = 0; i < s.length; i++) {
      const c = s[i]!;
      if (isSpace(c)) {
        if (!text.length || text[text.length - 1] === ' ') continue;
        text += ' ';
      } else {
        text += c;
      }
      nodes.push(t);
      offsets.push(i);
    }
  }
  return { root, text, nodes, offsets };
}

/** The DOM Range of text[start, end). */
export function rangeOf(index: TextIndex, span: TextSpan): Range {
  const r = index.root.ownerDocument.createRange();
  r.setStart(index.nodes[span.start]!, index.offsets[span.start]!);
  r.setEnd(index.nodes[span.end - 1]!, index.offsets[span.end - 1]! + 1);
  return r;
}

/** The node holding text[at]. */
export const nodeAt = (index: TextIndex, at: number): Text | undefined => index.nodes[at];

/**
 * The span of the index covered by a DOM Range (a selection): the characters whose start and end both lie in it.
 * Null when the range covers no indexed character.
 */
export function spanOf(index: TextIndex, range: Range): TextSpan | null {
  const n = index.nodes.length;
  const before = (i: number) => { try { return range.comparePoint(index.nodes[i]!, index.offsets[i]!) < 0; } catch { return true; } };
  const after = (i: number) => { try { return range.comparePoint(index.nodes[i]!, index.offsets[i]! + 1) > 0; } catch { return true; } };
  // First character not before the range start.
  let lo = 0, hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (before(mid)) lo = mid + 1; else hi = mid; }
  const start = lo;
  // First character that ends after the range end.
  lo = start; hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (after(mid)) hi = mid; else lo = mid + 1; }
  const end = lo;
  return end > start ? { start, end } : null;
}

export { normalizeSpace };
