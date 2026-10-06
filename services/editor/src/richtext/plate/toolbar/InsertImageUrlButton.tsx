// Insert an image by URL (replaces the previous editor's built-in "Insert image" dialog). Nothing is uploaded.
import { useState, type FormEvent } from 'react';
import { useEditorRef } from 'platejs/react';
import { ImageIcon } from 'lucide-react';
import { insertImage } from '../editor/transforms.js';
import { Button } from '../ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { ToolbarButton } from '../ui/toolbar.js';

export function InsertImageUrlButton() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const show = (next: boolean) => { setOpen(next); if (next) { setSrc(''); setAlt(''); } };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!src.trim()) return;
    insertImage(editor, { src: src.trim(), alt });
    setOpen(false);
    editor.tf.focus();
  };
  return (<>
    <ToolbarButton tooltip="Insert image by URL" aria-label="Insert image by URL" onMouseDown={(e) => e.preventDefault()} onClick={() => show(true)}>
      <ImageIcon />
    </ToolbarButton>
    <Dialog open={open} onOpenChange={show}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Insert image by URL</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-xs">URL<Input autoFocus value={src} onChange={(e) => setSrc(e.target.value)} placeholder="/CloudDocumentationPersonal/uploads/picture.png" /></label>
          <label className="grid gap-1 text-xs">Alt text<Input value={alt} onChange={(e) => setAlt(e.target.value)} /></label>
          <DialogFooter><Button type="submit" disabled={!src.trim()}>Insert</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>);
}
