import { describe, it, expect, beforeEach } from 'vitest';
import type { CommentThread } from '@platform/contracts';
import { anchorForRange, anchorThreads, MAX_QUOTE } from './anchor.js';
import { buildTextIndex } from './textIndex.js';

const PAGE = `
  <h2>Storage<a class="hash-link" href="#storage">&#8203;</a></h2>
  <p>Items are <strong>stored</strong> in slots.
     Slots hold one stack.</p>
  <div class="tabs-container">
    <ul role="tablist" class="tabs">
      <li role="tab" class="tabs__item" data-tab-value="use">How to use</li>
      <li role="tab" class="tabs__item" data-tab-value="api">API</li>
    </ul>
    <div class="margin-top--md">
      <div role="tabpanel"><p>Call open to start.</p></div>
      <div role="tabpanel" hidden><p>Call open to start. It returns a handle.</p></div>
    </div>
  </div>
  <button>Copy</button>
`;

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = `<article><div class="theme-doc-markdown markdown">${PAGE}</div></article>`;
  root = document.querySelector('.theme-doc-markdown')!;
});

/** A DOM Range over the n-th occurrence of `text` inside the element matched by `selector`. */
function select(selector: string, text: string, nth = 0): Range {
  const el = [...root.querySelectorAll(selector)].find((e) => e.textContent!.includes(text))!;
  const idx = buildTextIndex(el);
  let at = -1;
  for (let i = 0; i <= nth; i++) at = idx.text.indexOf(text, at + 1);
  const r = document.createRange();
  r.setStart(idx.nodes[at]!, idx.offsets[at]!);
  r.setEnd(idx.nodes[at + text.length - 1]!, idx.offsets[at + text.length - 1]! + 1);
  return r;
}

const thread = (id: string, anchor: CommentThread['anchor']): CommentThread => ({ id, anchor, body: 'x', author: { login: 'm', name: 'M' }, createdAt: '', status: 'open', replies: [] });

describe('the page text index', () => {
  it('collapses whitespace and leaves out tab labels, buttons and heading anchors', () => {
    const text = buildTextIndex(root).text;
    expect(text).toContain('Items are stored in slots. Slots hold one stack.');
    expect(text).not.toContain('How to use');
    expect(text).not.toContain('Copy');
    expect(text).not.toContain('​');
  });
});

describe('anchorForRange', () => {
  it('keeps the quote across inline markup, with context, and no tab outside tabs', () => {
    const a = anchorForRange(root, select('p', 'are stored in'));
    expect(a).toMatchObject({ exact: 'are stored in', tab: null });
    expect(a !== 'too-long' && a?.prefix.endsWith('Items ')).toBe(true);
    expect(a !== 'too-long' && a?.suffix.startsWith(' slots.')).toBe(true);
  });

  it('remembers the tab (group, value, label) of text inside a tab panel', () => {
    const a = anchorForRange(root, select('[role=tabpanel]:nth-of-type(2) p', 'returns a handle'));
    expect(a).toMatchObject({ exact: 'returns a handle', tab: { group: 0, value: 'api', label: 'API' } });
  });

  it('ignores a selection with only spaces, and refuses a very long one', () => {
    const r = document.createRange();
    r.selectNodeContents(root.querySelector('ul')!);
    expect(anchorForRange(root, r)).toBeNull();
    root.querySelector('p')!.append(document.createTextNode(' word'.repeat(MAX_QUOTE)));
    const all = document.createRange();
    all.selectNodeContents(root);
    expect(anchorForRange(root, all)).toBe('too-long');
  });
});

describe('anchorThreads', () => {
  it('finds each quote again, in its own tab when the same text is in two tabs', () => {
    const inApi = anchorForRange(root, select('[role=tabpanel]:nth-of-type(2) p', 'Call open'));
    const inUse = anchorForRange(root, select('[role=tabpanel]:nth-of-type(1) p', 'Call open'));
    if (!inApi || inApi === 'too-long' || !inUse || inUse === 'too-long') throw new Error('no anchor');
    const { attached, unattached } = anchorThreads(root, [thread('api', inApi), thread('use', inUse)]);
    expect(unattached).toEqual([]);
    expect(attached.get('api')!.tab!.tab.value).toBe('api');
    expect(attached.get('use')!.tab!.tab.value).toBe('use');
    expect(attached.get('api')!.range.toString()).toBe('Call open');
    expect(root.querySelectorAll('[role=tabpanel]')[1]!.contains(attached.get('api')!.range.startContainer)).toBe(true);
  });

  it('a comment whose text was edited away is unattached; the others stay attached', () => {
    const a = anchorForRange(root, select('p', 'one stack'));
    const b = anchorForRange(root, select('p', 'in slots'));
    if (!a || a === 'too-long' || !b || b === 'too-long') throw new Error('no anchor');
    root.querySelector('p')!.innerHTML = 'Items are kept in slots. Slots hold two stacks.';
    const { attached, unattached } = anchorThreads(root, [thread('a', a), thread('b', b)]);
    expect(unattached).toEqual(['a']);
    expect(attached.get('b')!.range.toString()).toBe('in slots');
  });

  it('a renamed tab group or moved text is still found anywhere on the page', () => {
    const { attached } = anchorThreads(root, [thread('x', { exact: 'It returns a handle', prefix: '', suffix: '', tab: { group: 3, value: 'gone', label: 'Gone' } })]);
    expect(attached.get('x')!.tab!.tab.value).toBe('api');
  });
});
