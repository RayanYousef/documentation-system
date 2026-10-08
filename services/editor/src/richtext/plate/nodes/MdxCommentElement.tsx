// HTML comments: kept as small hidden markers and written back as <!-- ... -->.
import { PlateElement, type PlateElementProps } from 'platejs/react';
import { MessageSquareDashed } from 'lucide-react';

const commentText = (value: unknown) => String(value ?? '').replace(/^\s*\/\*([\s\S]*)\*\/\s*$/, '$1').trim();

export function MdxCommentElement(props: PlateElementProps) {
  return (
    <PlateElement {...props}>
      <div contentEditable={false} className="flex items-center gap-1 text-xs text-faint select-none">
        <MessageSquareDashed className="size-3" /> {commentText(props.element.value)}
      </div>
      {props.children}
    </PlateElement>
  );
}

export function MdxInlineCommentElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="span">
      <span contentEditable={false} title={commentText(props.element.value)} className="mx-0.5 rounded bg-muted px-1 text-[10px] text-muted-foreground select-none">
        comment
      </span>
      {props.children}
    </PlateElement>
  );
}
