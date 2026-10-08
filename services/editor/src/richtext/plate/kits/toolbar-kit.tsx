// The fixed toolbar above the page, the floating toolbar over a text selection, and the floating
// link toolbar (edit, open, remove). None of them render when the editor is read-only.
import type { ReactNode } from 'react';
import { createPlatePlugin, useEditorReadOnly } from 'platejs/react';
import { FixedToolbarButtons } from '../toolbar/FixedToolbarButtons.js';
import { FloatingToolbarButtons } from '../toolbar/FloatingToolbarButtons.js';
import { FixedToolbar } from '../ui/fixed-toolbar.js';
import { FloatingToolbar } from '../ui/floating-toolbar.js';
import { LinkFloatingToolbar } from '../ui/link-toolbar.js';

function Editable({ children }: { children: ReactNode }) {
  return useEditorReadOnly() ? null : children;
}

export const ToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <Editable>
          {/* -top-6 (-1.5rem) cancels .main's 1.5rem padding-top (theme/arcade.css), so the toolbar sticks flush to the top of the scroll pane. */}
          <FixedToolbar aria-label="Formatting" className="-top-6">
            <FixedToolbarButtons />
          </FixedToolbar>
        </Editable>
      ),
    },
  }),
  createPlatePlugin({
    key: 'floating-toolbar',
    render: {
      afterEditable: () => (
        <Editable>
          <FloatingToolbar aria-label="Selection formatting">
            <FloatingToolbarButtons />
          </FloatingToolbar>
        </Editable>
      ),
    },
  }),
  createPlatePlugin({
    key: 'link-floating-toolbar',
    render: { afterEditable: () => <Editable><LinkFloatingToolbar /></Editable> },
  }),
];
