// The toolbars for in-page editing: the same buttons as ToolbarKit, with the fixed toolbar sticking just
// below the site navbar and the edit bar (--ped-sticky-top, set by the in-page theme) instead of at the
// top of a scroll pane.
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

export const PageToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <Editable>
          <FixedToolbar aria-label="Formatting" className="ped-ui ped-toolbar top-(--ped-sticky-top) rounded-md border">
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
