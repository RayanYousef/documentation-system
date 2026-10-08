// A folder intro (index.md) is edited in place like any page, but its generated okf block belongs to
// okf:generate. Before saving, the block must be exactly what was loaded; the save regenerates it.
import { splitFolderIntro } from '../mdx/folderIntro.js';

export const GENERATED_BLOCK_CHANGED = 'The generated index block of this folder intro changed. It is written by okf:generate; undo the change (or edit only the text around it) and save again.';

/** null when `next` keeps the generated block of `loaded` byte for byte, else the reason to refuse. */
export function folderIntroProblem(loaded: string, next: string): string | null {
  return splitFolderIntro(loaded).generated === splitFolderIntro(next).generated ? null : GENERATED_BLOCK_CHANGED;
}
