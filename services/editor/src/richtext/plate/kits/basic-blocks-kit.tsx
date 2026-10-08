// From the Plate UI registry `basic-blocks-kit` (MIT): paragraph, headings 1-6, quote, rule,
// with their Markdown input rules (`# `, `> `, `---`). The block rules are off inside a table cell.
import { BlockquoteRules, HeadingRules, HorizontalRuleRules } from '@platejs/basic-nodes';
import { BlockquotePlugin, H1Plugin, H2Plugin, H3Plugin, H4Plugin, H5Plugin, H6Plugin, HorizontalRulePlugin } from '@platejs/basic-nodes/react';
import { ParagraphPlugin } from 'platejs/react';
import { outsideTable } from '../editor/table.js';
import { BlockquoteElement } from '../ui/blockquote-node.js';
import { H1Element, H2Element, H3Element, H4Element, H5Element, H6Element } from '../ui/heading-node.js';
import { HrElement } from '../ui/hr-node.js';
import { ParagraphElement } from '../ui/paragraph-node.js';

const heading = (plugin: typeof H1Plugin, component: typeof H1Element, level: number) =>
  plugin.configure({
    inputRules: [HeadingRules.markdown({ enabled: outsideTable })],
    node: { component },
    rules: { break: { empty: 'reset' } },
    shortcuts: { toggle: { keys: `mod+alt+${level}` } },
  });

export const BasicBlocksKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  heading(H1Plugin, H1Element, 1),
  heading(H2Plugin, H2Element, 2),
  heading(H3Plugin, H3Element, 3),
  heading(H4Plugin, H4Element, 4),
  heading(H5Plugin, H5Element, 5),
  heading(H6Plugin, H6Element, 6),
  BlockquotePlugin.configure({
    inputRules: [BlockquoteRules.markdown({ enabled: outsideTable })],
    node: { component: BlockquoteElement },
    shortcuts: { toggle: { keys: 'mod+shift+period' } },
  }),
  HorizontalRulePlugin.configure({
    inputRules: [HorizontalRuleRules.markdown({ variant: '-', enabled: outsideTable }), HorizontalRuleRules.markdown({ variant: '_', enabled: outsideTable })],
    node: { component: HrElement },
  }),
];
