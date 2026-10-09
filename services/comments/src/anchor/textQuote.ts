// Text-quote anchoring on a plain string (the page's text with whitespace runs collapsed to one space):
// a comment keeps the quoted text plus some text before and after it, like a W3C TextQuoteSelector.

/** Characters of context kept on each side of the quote. */
export const CONTEXT_CHARS = 32;

export interface Quote { exact: string; prefix: string; suffix: string }
export interface TextSpan { start: number; end: number }

const SPACE = /\s+/g;
/** Every whitespace run as one space (the page text is indexed the same way). */
export const normalizeSpace = (s: string): string => s.replace(SPACE, ' ');

/** The span without spaces at its ends; null when nothing else is left. */
export function trimRange(text: string, start: number, end: number): TextSpan | null {
  while (start < end && text[start] === ' ') start++;
  while (end > start && text[end - 1] === ' ') end--;
  return start < end ? { start, end } : null;
}

/** The quote of text[start, end). */
export function quoteAt(text: string, start: number, end: number, context: number = CONTEXT_CHARS): Quote {
  return { exact: text.slice(start, end), prefix: text.slice(Math.max(0, start - context), start), suffix: text.slice(end, end + context) };
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Where the quote is in `text`: every occurrence of the exact text is scored by how much of the stored text
 * before and after it still matches, and the best wins (the first on a tie). `prefer` narrows the candidates
 * (for example to the comment's tab) when it accepts at least one. Null when the exact text is gone.
 */
export function findQuote(text: string, quote: Quote, prefer?: (start: number) => boolean): TextSpan | null {
  const exact = normalizeSpace(quote.exact);
  if (!exact) return null;
  const prefix = normalizeSpace(quote.prefix);
  const suffix = normalizeSpace(quote.suffix);
  const all: number[] = [];
  for (let at = text.indexOf(exact); at !== -1; at = text.indexOf(exact, at + 1)) all.push(at);
  if (!all.length) return null;
  const preferred = prefer ? all.filter(prefer) : [];
  const candidates = preferred.length ? preferred : all;
  let best = candidates[0]!;
  let bestScore = -1;
  for (const start of candidates) {
    const end = start + exact.length;
    const score = commonSuffix(prefix, text.slice(Math.max(0, start - prefix.length), start)) + commonPrefix(suffix, text.slice(end, end + suffix.length));
    if (score > bestScore) { best = start; bestScore = score; }
  }
  return { start: best, end: best + exact.length };
}
