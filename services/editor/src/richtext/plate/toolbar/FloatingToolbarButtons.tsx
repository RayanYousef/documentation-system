// The toolbar over a text selection: block type, marks, link.
import { LinkToolbarButton } from '../ui/link-toolbar-button.js';
import { ToolbarGroup } from '../ui/toolbar.js';
import { TurnIntoToolbarButton } from '../ui/turn-into-toolbar-button.js';
import { MarkButtons } from './FixedToolbarButtons.js';

export function FloatingToolbarButtons() {
  return (
    <ToolbarGroup>
      <TurnIntoToolbarButton />
      <MarkButtons />
      <LinkToolbarButton aria-label="Link" />
    </ToolbarGroup>
  );
}
