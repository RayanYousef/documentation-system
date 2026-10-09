import { describe, it, expect } from 'vitest';
import { folderIntroProblem, GENERATED_BLOCK_CHANGED } from './folderIntroGuard.js';

const index = '---\ntitle: Systems\n---\n\nIntro.\n\n<!-- okf:index -->\n## Pages\n* [A](a.md) - a.\n<!-- /okf:index -->\n';

describe('folderIntroProblem', () => {
  it('accepts changes around the generated block', () => {
    expect(folderIntroProblem(index, index.replace('Intro.', 'New intro.').replace('title: Systems', 'title: Game systems'))).toBeNull();
  });
  it('refuses a changed generated block', () => {
    expect(folderIntroProblem(index, index.replace('* [A](a.md) - a.', '* [A](a.md) - edited.'))).toBe(GENERATED_BLOCK_CHANGED);
  });
  it('refuses a removed generated block', () => {
    expect(folderIntroProblem(index, '---\ntitle: Systems\n---\n\nIntro.\n')).toBe(GENERATED_BLOCK_CHANGED);
  });
  it('accepts a page that never had one', () => {
    expect(folderIntroProblem('Intro.\n', 'Intro, edited.\n')).toBeNull();
  });
});
