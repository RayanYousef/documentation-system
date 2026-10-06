// The "/" menu. Not offered inside code blocks.
import { SlashInputPlugin, SlashPlugin } from '@platejs/slash-command/react';
import { KEYS, type SlateEditor } from 'platejs';
import { SlashInputElement } from '../slash/SlashInputElement.js';

export const SlashKit = [
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor: SlateEditor) => !editor.api.some({ match: { type: editor.getType(KEYS.codeBlock) } }),
    },
  }),
  SlashInputPlugin.withComponent(SlashInputElement),
];
