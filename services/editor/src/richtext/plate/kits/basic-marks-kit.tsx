// From the Plate UI registry `basic-marks-kit` (MIT), trimmed to the marks Markdown can store:
// bold, italic, underline (written as <u>), strikethrough and inline code.
import { BoldRules, CodeRules, ItalicRules, MarkComboRules, StrikethroughRules, UnderlineRules } from '@platejs/basic-nodes';
import { BoldPlugin, CodePlugin, ItalicPlugin, StrikethroughPlugin, UnderlinePlugin } from '@platejs/basic-nodes/react';
import { CodeLeaf } from '../ui/code-node.js';

export const BasicMarksKit = [
  BoldPlugin.configure({
    inputRules: [
      BoldRules.markdown({ variant: '*' }),
      BoldRules.markdown({ variant: '_' }),
      MarkComboRules.markdown({ variant: 'boldItalic' }),
      MarkComboRules.markdown({ variant: 'boldUnderline' }),
      MarkComboRules.markdown({ variant: 'boldItalicUnderline' }),
      MarkComboRules.markdown({ variant: 'italicUnderline' }),
    ],
  }),
  ItalicPlugin.configure({ inputRules: [ItalicRules.markdown({ variant: '*' }), ItalicRules.markdown({ variant: '_' })] }),
  UnderlinePlugin.configure({ inputRules: [UnderlineRules.markdown()] }),
  CodePlugin.configure({
    inputRules: [CodeRules.markdown()],
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
  StrikethroughPlugin.configure({
    inputRules: [StrikethroughRules.markdown()],
    shortcuts: { toggle: { keys: 'mod+shift+x' } },
  }),
];
