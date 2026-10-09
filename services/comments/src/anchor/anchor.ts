// Comments <-> page text. A new comment stores the selected text's quote and tab; showing the comments finds
// each quote again in the page (preferring the stored tab). A quote that is gone leaves its comment unattached.
import type { CommentAnchor, CommentThread } from '@platform/contracts';
import { buildTextIndex, nodeAt, rangeOf, spanOf, type TextIndex } from './textIndex.js';
import { findQuote, quoteAt, trimRange } from './textQuote.js';
import { panelOf, tabOf, type PanelInfo } from './tabs.js';

/** Longest quote a comment may keep (a selection over most of a page is almost certainly a mistake). */
export const MAX_QUOTE = 1000;

/** The anchor of a selection inside `root`, or null when it holds no page text. 'too-long' over MAX_QUOTE characters. */
export function anchorForRange(root: Element, range: Range, index: TextIndex = buildTextIndex(root)): CommentAnchor | 'too-long' | null {
  const span = spanOf(index, range);
  const trimmed = span && trimRange(index.text, span.start, span.end);
  if (!trimmed) return null;
  if (trimmed.end - trimmed.start > MAX_QUOTE) return 'too-long';
  const where = tabOf(root, nodeAt(index, trimmed.start)!);
  return { ...quoteAt(index.text, trimmed.start, trimmed.end), tab: where?.tab ?? null };
}

export interface Attached {
  range: Range;
  /** The tab the text was found in (not necessarily the stored one), or null. */
  tab: PanelInfo | null;
  /** Position in the page text (document order). */
  start: number;
}

export interface Anchoring { attached: Map<string, Attached>; unattached: string[] }

/** Finds every thread's quote in the page. */
export function anchorThreads(root: Element, threads: readonly CommentThread[], index: TextIndex = buildTextIndex(root)): Anchoring {
  const attached = new Map<string, Attached>();
  const unattached: string[] = [];
  for (const t of threads) {
    const panel = t.anchor.tab ? panelOf(root, t.anchor.tab) : null;
    const span = findQuote(index.text, t.anchor, panel ? (start) => panel.contains(nodeAt(index, start)!) : undefined);
    if (!span) { unattached.push(t.id); continue; }
    attached.set(t.id, { range: rangeOf(index, span), tab: tabOf(root, nodeAt(index, span.start)!), start: span.start });
  }
  return { attached, unattached };
}
