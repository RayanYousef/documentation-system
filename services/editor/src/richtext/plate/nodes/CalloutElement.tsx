// :::note / :::tip / :::info / :::caution / :::danger admonitions.
// Replaces the stock callout node (which pulls an emoji picker). Colours come from the --ed-adm-* tokens.
import { PlateElement, type PlateElementProps } from 'platejs/react';

// Full class names (not built from parts) so Tailwind finds them.
const STYLES: Record<string, string> = {
  note: 'border-(--ed-adm-note-line) bg-(--ed-adm-note-bg)',
  tip: 'border-(--ed-adm-tip-line) bg-(--ed-adm-tip-bg)',
  info: 'border-(--ed-adm-info-line) bg-(--ed-adm-info-bg)',
  caution: 'border-(--ed-adm-caution-line) bg-(--ed-adm-caution-bg)',
  danger: 'border-(--ed-adm-danger-line) bg-(--ed-adm-danger-bg)',
};

export function CalloutElement(props: PlateElementProps) {
  const variant = typeof props.element.variant === 'string' ? props.element.variant : 'note';
  const title = props.element.title;
  return (
    <PlateElement {...props} className={`my-3 rounded-md border-l-4 px-4 py-2 ${STYLES[variant] ?? STYLES.note}`}>
      <div contentEditable={false} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase select-none">
        {variant}
        {typeof title === 'string' && title ? `: ${title}` : ''}
      </div>
      {props.children}
    </PlateElement>
  );
}
