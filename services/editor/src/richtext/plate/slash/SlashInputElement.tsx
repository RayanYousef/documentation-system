// The "/" menu. Built from the stock Plate UI `slash-node` (MIT) without the AI group. Two groups:
// basic blocks, and docs blocks (admonitions plus every entry of the components manifest).
import type { ReactNode } from 'react';
import { KEYS, type TComboboxInputElement } from 'platejs';
import { PlateElement, type PlateEditor, type PlateElementProps } from 'platejs/react';
import {
  Box, Code2, Heading1Icon, Heading2Icon, Heading3Icon, Layers, ListIcon, ListOrdered, MessageSquareWarning, Minus, PilcrowIcon, Puzzle, Quote, Square, Table,
} from 'lucide-react';
import type { ComponentsManifest } from '@platform/contracts';
import { useDocsComponents } from '../context.js';
import { ADMONITION_VARIANTS, insertBasicBlock, insertCallout, insertComponent } from '../editor/transforms.js';
import { jsxTypeFor } from '../markdown/componentRules.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import {
  InlineCombobox, InlineComboboxContent, InlineComboboxEmpty, InlineComboboxGroup, InlineComboboxGroupLabel, InlineComboboxInput, InlineComboboxItem,
} from '../ui/inline-combobox.js';

interface Item { value: string; label: string; icon: ReactNode; keywords?: string[]; run(editor: PlateEditor): void }
interface Group { group: string; items: Item[] }

const basic = (value: string, label: string, icon: ReactNode, keywords?: string[]): Item =>
  ({ value, label, icon, keywords, run: (editor) => insertBasicBlock(editor, value) });

const BASIC: Group = {
  group: 'Basic blocks',
  items: [
    basic(KEYS.p, 'Text', <PilcrowIcon />, ['paragraph']),
    basic(KEYS.h1, 'Heading 1', <Heading1Icon />, ['title', 'h1']),
    basic(KEYS.h2, 'Heading 2', <Heading2Icon />, ['subtitle', 'h2']),
    basic(KEYS.h3, 'Heading 3', <Heading3Icon />, ['h3']),
    basic(KEYS.ul, 'Bulleted list', <ListIcon />, ['unordered', 'ul', '-']),
    basic(KEYS.ol, 'Numbered list', <ListOrdered />, ['ordered', 'ol', '1']),
    basic(KEYS.listTodo, 'To-do list', <Square />, ['checklist', 'task', '[]']),
    basic(KEYS.codeBlock, 'Code block', <Code2 />, ['```']),
    basic(KEYS.table, 'Table', <Table />),
    basic(KEYS.blockquote, 'Quote', <Quote />, ['blockquote', '>']),
    basic(KEYS.hr, 'Divider', <Minus />, ['hr', 'rule', '---']),
  ],
};

const iconFor = (type: string): ReactNode =>
  type === DOCS_KEYS.modelViewer || type === DOCS_KEYS.fbxViewer ? <Box /> : type === DOCS_KEYS.tabs || type === DOCS_KEYS.tabItem ? <Layers /> : <Puzzle />;

function docsGroup(manifest: ComponentsManifest): Group {
  return {
    group: 'Docs blocks',
    items: [
      ...ADMONITION_VARIANTS.map((v): Item => ({
        value: `callout_${v}`, label: `Admonition (:::${v})`, icon: <MessageSquareWarning />, keywords: ['admonition', 'callout', ':::', v],
        run: (editor) => insertCallout(editor, v),
      })),
      ...manifest.components.map((c): Item => ({
        value: `component_${c.name}`, label: c.name, icon: iconFor(jsxTypeFor(c)), keywords: ['component', '3d', 'model', 'viewer', c.name.toLowerCase()],
        run: (editor) => insertComponent(editor, manifest, c),
      })),
    ],
  };
}

export function SlashInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;
  const manifest = useDocsComponents();
  const groups = [BASIC, docsGroup(manifest)];
  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />
        <InlineComboboxContent>
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>
          {groups.map(({ group, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>{group}</InlineComboboxGroupLabel>
              {items.map((item) => (
                <InlineComboboxItem key={item.value} value={item.value} label={item.label} group={group} keywords={item.keywords} onClick={() => item.run(editor)}>
                  <div className="mr-2 text-muted-foreground">{item.icon}</div>
                  {item.label}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>
      {props.children}
    </PlateElement>
  );
}
