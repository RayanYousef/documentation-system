// Code blocks with syntax colours. lowlight `common` (about 35 languages), never `all`.
import { CodeBlockRules } from '@platejs/code-block';
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from '@platejs/code-block/react';
import { common, createLowlight } from 'lowlight';
import { outsideTable } from '../editor/table.js';
import { CodeBlockElement, CodeLineElement, CodeSyntaxLeaf } from '../ui/code-block-node.js';

const lowlight = createLowlight(common);

export const CodeBlockKit = [
  CodeBlockPlugin.configure({
    inputRules: [CodeBlockRules.markdown({ on: 'match', enabled: outsideTable })], // never in a table cell
    node: { component: CodeBlockElement },
    options: { lowlight, defaultLanguage: 'text' },
    shortcuts: { toggle: { keys: 'mod+alt+8' } },
  }),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
];
