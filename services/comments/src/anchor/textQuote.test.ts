import { describe, it, expect } from 'vitest';
import { findQuote, normalizeSpace, quoteAt, trimRange } from './textQuote.js';

const TEXT = 'Items are stored in slots. Slots hold one stack. Items are stored in the bank when the bag is full.';

describe('quoteAt', () => {
  it('keeps the quoted text plus up to 32 characters before and after', () => {
    const start = TEXT.lastIndexOf('stored');
    expect(quoteAt(TEXT, start, start + 'stored'.length)).toEqual({ exact: 'stored', prefix: 'slots. Slots hold one stack. Items are '.slice(-32), suffix: ' in the bank when the bag is full'.slice(0, 32) });
  });

  it('stops at the start and end of the text', () => {
    expect(quoteAt('Hello world', 0, 5)).toEqual({ exact: 'Hello', prefix: '', suffix: ' world' });
  });
});

describe('trimRange', () => {
  it('drops spaces at both ends of a selection', () => {
    expect(trimRange(' ab c ', 0, 6)).toEqual({ start: 1, end: 5 });
    expect(trimRange('   ', 0, 3)).toBeNull();
  });
});

describe('findQuote', () => {
  it('finds the occurrence whose surrounding text matches, not just the first one', () => {
    const second = TEXT.lastIndexOf('stored');
    const q = quoteAt(TEXT, second, second + 6);
    expect(findQuote(TEXT, q)).toEqual({ start: second, end: second + 6 });
    const first = TEXT.indexOf('stored');
    expect(findQuote(TEXT, quoteAt(TEXT, first, first + 6))).toEqual({ start: first, end: first + 6 });
  });

  it('still finds the text when the words around it changed', () => {
    const at = TEXT.lastIndexOf('the bank');
    const q = quoteAt(TEXT, at, at + 'the bank'.length);
    const edited = TEXT.replace('when the bag is full', 'once every slot is taken');
    expect(findQuote(edited, q)).toEqual({ start: at, end: at + 'the bank'.length });
  });

  it('returns null when the quoted text is gone (the comment becomes unattached)', () => {
    const at = TEXT.indexOf('one stack');
    const q = quoteAt(TEXT, at, at + 'one stack'.length);
    expect(findQuote(TEXT.replace('one stack', 'two stacks'), q)).toBeNull();
  });

  it('prefers occurrences the caller accepts (the comment\'s tab), else takes any', () => {
    const first = TEXT.indexOf('Items are stored');
    const q = { exact: 'Items are stored', prefix: '', suffix: '' };
    const second = TEXT.lastIndexOf('Items are stored');
    expect(findQuote(TEXT, q, (s) => s === second)).toEqual({ start: second, end: second + q.exact.length });
    expect(findQuote(TEXT, q, () => false)).toEqual({ start: first, end: first + q.exact.length });
  });

  it('matches across collapsed whitespace', () => {
    expect(normalizeSpace('a \n\t b  c')).toBe('a b c');
    expect(findQuote('one two three', { exact: 'two\n three', prefix: 'one  ', suffix: '' })).toEqual({ start: 4, end: 13 });
  });
});
