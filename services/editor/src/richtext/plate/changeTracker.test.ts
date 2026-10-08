import { describe, it, expect } from 'vitest';
import { createChangeTracker } from './changeTracker.js';

describe('createChangeTracker', () => {
  it('equal Markdown is not a change', () => {
    expect(createChangeTracker('## A\n\nText.\n').isChanged('## A\n\nText.\n')).toBe(false);
  });
  it('different Markdown is a change', () => {
    expect(createChangeTracker('## A\n\nText.\n').isChanged('## A\n\nText!\n')).toBe(true);
  });
  it('an empty baseline compares like any other text', () => {
    const t = createChangeTracker('');
    expect(t.isChanged('')).toBe(false);
    expect(t.isChanged('x\n')).toBe(true);
  });
});
