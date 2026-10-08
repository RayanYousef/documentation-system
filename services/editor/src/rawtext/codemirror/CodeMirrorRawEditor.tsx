// CodeMirror 6 implementation of RawTextEditor: Markdown highlighting, undo history, the default keymap
// (Tab indents), line wrapping. One EditorView per mount; outside value changes are dispatched only when
// they differ from the document, so typing never loops through React state.
import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Annotation, Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { RawTextEditorProps } from '../RawTextEditor.js';

/** Colours come from the page (the in-page theme maps --ed-* onto the site palette). */
const pageTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--ed-code-bg)', color: 'var(--ed-text)', border: '1px solid var(--ed-line)', borderRadius: 'var(--ed-radius)', fontSize: '0.9rem' },
  '&.cm-focused': { outline: '2px solid var(--ed-focus)', outlineOffset: '1px' },
  '.cm-content': { fontFamily: 'var(--ed-mono)', padding: '0.75rem 0', caretColor: 'var(--ed-text)', minHeight: '50vh' },
  '.cm-line': { padding: '0 0.75rem' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ed-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--ed-code-selection)' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
});

/** Marks transactions that apply an outside value, so they are not reported back as user edits. */
const external = Annotation.define<boolean>();

export function CodeMirrorRawEditor({ value, readOnly, ariaLabel, onChange }: RawTextEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editable = useRef(new Compartment());

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel, 'aria-multiline': 'true', spellcheck: 'false' }),
          editable.current.of([EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)]),
          pageTheme,
          EditorView.updateListener.of((u) => { if (u.docChanged && !u.transactions.every((t) => t.annotation(external))) onChangeRef.current(u.state.doc.toString()); }),
        ],
      }),
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
  }, []); // one view per mount; value and readOnly changes are applied by the effects below

  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: external.of(true) });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure([EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)]) });
  }, [readOnly]);

  return <div ref={host} className="ped-raw" data-testid="raw-text-editor" />;
}
