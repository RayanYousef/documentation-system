// From the Plate UI registry `block-selection-kit` (MIT). The AI hotkey is removed.
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { getPluginTypes, KEYS } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { BlockSelection } from '../ui/block-selection.js';

const hasSelectableClass = ({ attributes, className }: { attributes: { className?: string }; className?: string }) =>
  [className, attributes.className].filter(Boolean).join(' ').includes('slate-selectable');

export const BlockSelectionKit = [
  BlockSelectionPlugin.configure(({ editor }) => ({
    options: {
      enableContextMenu: true,
      isSelectable: (element) => !getPluginTypes(editor, [KEYS.column, KEYS.codeLine, KEYS.td]).includes(element.type),
    },
    render: {
      belowRootNodes: (props) => {
        if (!hasSelectableClass(props)) return null;
        // The render props are the element's own PlateElementProps (Plate types them more loosely here).
        return <BlockSelection {...(props as unknown as PlateElementProps)} />;
      },
    },
  })),
];
