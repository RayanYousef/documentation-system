// Builds the file to save from the editing state. Pure, and byte-exact: a page that was not changed
// comes back exactly as it was loaded (unchanged keys keep their YAML, an unchanged body its bytes).
import { applyFields, splitDocument, type FrontmatterFields } from '../frontmatter/yamlDoc.js';

export type EditingMode = 'visual' | 'raw';

export interface ComposeInput {
  /** The text the visual editor was loaded from (the saved file, or the Raw text when switching back). */
  base: string;
  /** Frontmatter as edited (title, description, ...); null leaves the frontmatter as it is in `base`. */
  fields: FrontmatterFields | null;
  /** The body from the rich text editor; null keeps the body of `base`. */
  body: string | null;
  mode: EditingMode;
  /** The whole file as typed in Raw mode. */
  raw: string;
}

export function composeDocument({ base, fields, body, mode, raw }: ComposeInput): string {
  if (mode === 'raw') return raw;
  const withFields = fields ? applyFields(base, fields) : base;
  const { head, hasFrontmatter } = splitDocument(withFields);
  const content = body ?? splitDocument(base).body;
  if (!hasFrontmatter) return content;
  if (withFields === base && content === splitDocument(base).body) return base;
  return `---\n${head}\n---\n${content.startsWith('\n') ? content : `\n${content}`}`;
}
