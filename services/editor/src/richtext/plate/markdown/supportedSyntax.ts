// A whitelist pre-scan. A page that holds anything the rich editor cannot write back safely is
// reported, so the app opens it in Raw mode instead of losing or changing it on the first edit.
// Each rule below names a shape Plate's model cannot hold (it would be dropped, moved or merged on
// export). importBody also runs a full round-trip check after this scan, as a safety net.
import { remarkMdx } from '@platejs/markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export interface SupportedTags {
  /** JSX tags allowed as blocks (manifest components and the generated okf block). */
  flow: ReadonlySet<string>;
  /** Of those, the ones that must not have children. */
  voids: ReadonlySet<string>;
  /** JSX tags allowed inside a paragraph: `u` (underline) and `br` (a line break inside a table cell). */
  text: ReadonlySet<string>;
  /** Tab group tags (manifest preview "tabs"). Their children must be tab items. */
  tabs: ReadonlySet<string>;
  /** Tab item tags (manifest preview "tab-item"). They must sit directly inside a tab group. */
  tabItems: ReadonlySet<string>;
}

const ALLOWED = new Set([
  'root', 'paragraph', 'heading', 'text', 'emphasis', 'strong', 'delete', 'inlineCode', 'code', 'link', 'image',
  'list', 'listItem', 'blockquote', 'thematicBreak', 'break', 'table', 'tableRow', 'tableCell',
  'containerDirective', 'textDirective',
]);

/** Where a lone image (a paragraph holding only the image) may sit: Plate stores it as a block there. */
const IMAGE_BLOCK_PARENTS = new Set(['root', 'blockquote', 'containerDirective', 'mdxJsxFlowElement']);

/** `{/* ... *\/}`: what prepareBody turns an HTML comment into. Any other expression is real JS. */
const COMMENT_EXPRESSION = /^\s*\/\*[\s\S]*\*\/\s*$/;

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkMdx);

interface MdNode {
  type: string;
  name?: string | null;
  value?: string;
  title?: string | null;
  ordered?: boolean | null;
  start?: number | null;
  checked?: boolean | null;
  attributes?: unknown[] | Record<string, unknown> | null;
  data?: { directiveLabel?: boolean };
  children?: MdNode[];
  position?: { start: { line: number; offset?: number } };
}

/** Where the walk is: the parent chain and a few facts about the ancestors. */
interface Context {
  parent: MdNode | null;
  grandparent: MdNode | null;
  /** Inside a GFM table cell. */
  inCell: boolean;
}

const attributeCount = (n: MdNode): number =>
  Array.isArray(n.attributes) ? n.attributes.length : n.attributes ? Object.keys(n.attributes).length : 0;

/** Bulleted, numbered or to-do: Plate keeps two lists apart only when their kinds differ. */
const listKind = (n: MdNode): string =>
  n.children?.some((c) => c.checked != null) ? 'todo' : n.ordered ? 'numbered' : 'bulleted';

/** Problems found in a prepared body (see prepareBody). An empty list means the editor can take it. */
export function findUnsupported(prepared: string, tags: SupportedTags): string[] {
  let tree: MdNode;
  try {
    tree = parser.parse(prepared) as MdNode;
  } catch (e) {
    return [`MDX syntax error: ${(e as Error).message}`];
  }
  const errors: string[] = [];
  const at = (n: MdNode) => (n.position ? ` (line ${n.position.start.line})` : '');
  const walk = (n: MdNode, ctx: Context) => {
    const { parent, grandparent } = ctx;
    switch (n.type) {
      case 'mdxJsxFlowElement':
        if (!n.name || !tags.flow.has(n.name)) errors.push(`Unknown component <${n.name ?? ''}>${at(n)}`);
        else if (tags.voids.has(n.name) && n.children?.length) errors.push(`<${n.name}> cannot have children${at(n)}`);
        else if (tags.tabItems.has(n.name) && !(parent?.type === 'mdxJsxFlowElement' && parent.name && tags.tabs.has(parent.name))) {
          errors.push(`<${n.name}> outside a tab group${at(n)}`);
        } else if (tags.tabs.has(n.name) && n.children?.some((c) => !(c.type === 'mdxJsxFlowElement' && c.name && tags.tabItems.has(c.name)))) {
          errors.push(`<${n.name}> holds something that is not a tab item${at(n)}`);
        }
        break;
      case 'mdxJsxTextElement':
        if (!n.name || !tags.text.has(n.name)) errors.push(`<${n.name ?? ''}> inside a paragraph is not supported${at(n)}`);
        else if (attributeCount(n) > 0) errors.push(`<${n.name}> with attributes${at(n)}`);
        else if (n.name === 'br' && (n.children?.length || !ctx.inCell)) errors.push(`<br> outside a table cell${at(n)}`);
        break;
      case 'mdxFlowExpression':
      case 'mdxTextExpression':
        if (!COMMENT_EXPRESSION.test(n.value ?? '')) errors.push(`JavaScript expression {${n.value ?? ''}} is not supported${at(n)}`);
        break;
      case 'text':
        // remark keeps a soft line break as "\n" in the text; the writer would turn it into a hard break.
        if (n.value?.includes('\n')) errors.push(`Soft line break (a paragraph wrapped over lines)${at(n)}`);
        break;
      case 'inlineCode':
        if (n.value?.includes('\n')) errors.push(`Inline code wrapped over lines${at(n)}`);
        break;
      case 'image': {
        // Plate's image is a block. Only a paragraph that holds nothing but the image maps onto it.
        const alone = parent?.type === 'paragraph' && parent.children?.length === 1 && IMAGE_BLOCK_PARENTS.has(grandparent?.type ?? '');
        if (parent?.type !== 'tableCell' && !alone) errors.push(`Image inside text, a link, a heading or a list item${at(n)}`);
        break;
      }
      case 'link':
        if (n.title) errors.push(`Link title${at(n)}`);
        break;
      case 'list':
        if (n.start === 0) errors.push(`List starting at 0${at(n)}`);
        if (n.ordered && n.children?.some((c) => c.checked != null)) errors.push(`To-do item in a numbered list${at(n)}`);
        break;
      case 'listItem': {
        // Plate's list model keeps one paragraph per item, plus nested lists.
        const [first, ...rest] = n.children ?? [];
        if ((first && first.type !== 'paragraph') || rest.some((c) => c.type !== 'list')) {
          errors.push(`List item with more than one block${at(n)}`);
        }
        break;
      }
      case 'paragraph': {
        if (n.data?.directiveLabel && n.children?.some((c) => c.type !== 'text')) errors.push(`Formatting in an admonition title${at(n)}`);
        // The old Docusaurus title form `:::note Title` (and a lone `:::` line) is not a directive to
        // remark-directive, so it arrives here as plain text. The export would escape it as `\:::`, and the
        // admonition would vanish from the site. An escaped `\:::` in the source is real text: it writes
        // back the same way, so only an unescaped `:::` at the start of the paragraph counts.
        const offset = n.position?.start.offset;
        const source = offset == null ? null : prepared.slice(offset, offset + 3);
        const first = n.children?.[0];
        if (first?.type === 'text' && /^:{3}/.test(first.value ?? '') && (source == null || source === ':::')) {
          errors.push(`Line starting with ":::" that is not an admonition (old ":::note Title" form? write ":::note[Title]")${at(n)}`);
        }
        break;
      }
      case 'textDirective':
        if (attributeCount(n) > 0) errors.push(`Text directive with attributes${at(n)}`);
        break;
      default:
        if (!ALLOWED.has(n.type)) errors.push(`Unsupported Markdown: ${n.type}${at(n)}`);
    }
    const kids = n.children ?? [];
    kids.forEach((c, i) => {
      // Two lists of the same kind in a row (`- a` then `* b`) become one list in Plate.
      const prev = kids[i - 1];
      if (c.type === 'list' && prev?.type === 'list' && listKind(c) === listKind(prev)) errors.push(`Two lists next to each other${at(c)}`);
      walk(c, {
        parent: n,
        grandparent: parent,
        inCell: ctx.inCell || n.type === 'tableCell',
      });
    });
  };
  walk(tree, { parent: null, grandparent: null, inCell: false });
  return errors;
}
