// One page body in Plate: Markdown in on mount, Markdown out through the handle.
// - The editor is created once per mount (App remounts it per page and after each save).
// - The baseline is the export of the freshly imported page. A change is reported only when the
//   export differs from it, so loading and normalising never make the page dirty.
// - getMarkdown() hands back the loaded bytes when nothing changed, so an unedited save is byte-exact.
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { MarkdownPlugin } from '@platejs/markdown';
import type { AnyPluginConfig, Value } from 'platejs';
import { Plate, usePlateEditor, type PlateEditor } from 'platejs/react';
import type { RichTextEditorProps } from '../RichTextEditor.js';
import { createChangeTracker } from './changeTracker.js';
import { buildDocsMarkdown, exportBody, importBody, type ImportResult } from './markdown/docsMarkdown.js';
import { Editor, EditorContainer } from './ui/editor.js';

export interface PlateDocumentProps extends Omit<RichTextEditorProps, 'services'> {
  plugins: AnyPluginConfig[];
  /** Test hook: the Plate editor instance. */
  editorRef?: Ref<PlateEditor>;
  /** Rendered inside <Plate>, before the content. */
  children?: ReactNode;
}

const EMPTY: Value = [{ type: 'p', children: [{ text: '' }] }];

export function PlateDocument({ markdown, readOnly, components, onChange, onParseError, ref, plugins, editorRef, children }: PlateDocumentProps) {
  const md = useMemo(() => buildDocsMarkdown(components), [components]);
  const mdRef = useRef(md);
  mdRef.current = md;
  const callbacks = useRef({ onChange, onParseError });
  callbacks.current = { onChange, onParseError };

  const loaded = useRef<ImportResult>({ value: [], errors: [], bullet: '*' });
  const editor = usePlateEditor({
    plugins,
    readOnly,
    shouldNormalizeEditor: true,
    value: (ed) => {
      ed.setOption(MarkdownPlugin, 'rules', md.rules); // paste uses the same rules
      loaded.current = importBody(ed, markdown, md);
      return loaded.current.value.length ? loaded.current.value : EMPTY;
    },
  });
  const failed = loaded.current.errors.length > 0;
  const { bullet } = loaded.current;
  const [tracker] = useState(() => createChangeTracker(failed ? markdown : exportBody(editor, editor.children, bullet, md)));
  const reported = useRef(false);

  // A late components manifest: new rules for export and paste, no remount.
  useEffect(() => { editor.setOption(MarkdownPlugin, 'rules', md.rules); }, [editor, md]);

  useEffect(() => {
    const { errors } = loaded.current;
    if (errors.length) callbacks.current.onParseError({ error: errors.join('; '), source: markdown });
  }, []); // once per mount: the import never changes after mount

  useImperativeHandle(ref, () => ({
    getMarkdown: () => {
      if (failed) return markdown;
      const out = exportBody(editor, editor.children, bullet, mdRef.current);
      return tracker.isChanged(out) ? out : markdown;
    },
  }), [editor, failed, markdown, bullet, tracker]);
  useImperativeHandle(editorRef, () => editor, [editor]);

  if (failed) return null;
  return (
    <Plate
      editor={editor}
      readOnly={readOnly}
      onValueChange={({ value }) => {
        if (reported.current) return; // after the first report, no more serializing per keystroke
        if (tracker.isChanged(exportBody(editor, value, bullet, mdRef.current))) {
          reported.current = true;
          callbacks.current.onChange();
        }
      }}
    >
      {children}
      {/* No overflow on the container: the page (.main) scrolls, so the fixed toolbar can stick to its top. */}
      <EditorContainer className="overflow-visible">
        <Editor variant="docs" readOnly={readOnly} aria-label="Page body" data-testid="rich-text-body" />
      </EditorContainer>
    </Plate>
  );
}
