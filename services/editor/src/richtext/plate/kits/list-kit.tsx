// From the Plate UI registry `list-kit` (MIT): bulleted, numbered and to-do lists with input rules
// (off inside a table cell).
import { BulletedListRules, isOrderedList, OrderedListRules, TaskListRules } from '@platejs/list';
import { ListPlugin } from '@platejs/list/react';
import { KEYS } from 'platejs';
import { outsideTable } from '../editor/table.js';
import { BlockList } from '../ui/block-list.js';
import { IndentKit } from './indent-kit.js';

export const ListKit = [
  ...IndentKit,
  ListPlugin.configure({
    inputRules: [
      BulletedListRules.markdown({ variant: '-', enabled: outsideTable }),
      BulletedListRules.markdown({ variant: '*', enabled: outsideTable }),
      OrderedListRules.markdown({ variant: '.', enabled: outsideTable }),
      OrderedListRules.markdown({ variant: ')', enabled: outsideTable }),
      TaskListRules.markdown({ checked: false, enabled: outsideTable }),
      TaskListRules.markdown({ checked: true, enabled: outsideTable }),
    ],
    inject: {
      nodeProps: {
        nodeKey: KEYS.listType,
        query: ({ nodeProps }) => !!nodeProps.element?.listStyleType && !isOrderedList(nodeProps.element),
        transformProps: ({ props }) => ({ ...props, role: 'listitem', style: { ...props.style, display: 'list-item' } }),
      },
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock, KEYS.img],
    },
    render: { belowNodes: BlockList },
  }),
];
