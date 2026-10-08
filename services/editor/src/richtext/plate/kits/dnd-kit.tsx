// Drag and drop. The table rows need DndPlugin and its provider (CoreKit). The full editor also shows a
// drag handle in the left gutter of every top-level block (DraggableDndKit).
import { DndPlugin } from '@platejs/dnd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BlockDraggable } from '../ui/block-draggable.js';

const DndBase = DndPlugin.configure({
  options: { enableScroller: true },
  render: { aboveSlate: ({ children }) => <DndProvider backend={HTML5Backend}>{children}</DndProvider> },
});

export const DndKit = [DndBase];

/** With block drag handles. Their tooltips need a TooltipProvider around the editor. */
export const DraggableDndKit = [
  DndBase.extend({ render: { aboveNodes: BlockDraggable } }),
];
