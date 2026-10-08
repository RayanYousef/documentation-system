
import { cn } from '@/richtext/plate/lib/utils';

import { Toolbar } from './toolbar';

export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      {...props}
      className={cn(
        'scrollbar-hide sticky top-0 left-0 z-50 w-full justify-between overflow-x-auto border-b border-b-border bg-band p-1',
        props.className
      )}
    />
  );
}
