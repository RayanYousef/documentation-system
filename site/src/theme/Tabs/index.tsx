// Wraps the theme's Tabs (swizzle --wrap): every tab label carries its value (`data-tab-value`, so a comment
// remembers which tab its text is in) and, when the page has open comments in that tab, their number
// (`data-comment-count`, drawn as a badge by the comments stylesheet). The DOM is still rendered by React only.
import React, { Children, cloneElement, isValidElement, useRef, type ReactElement, type ReactNode } from 'react';
import Tabs from '@theme-original/Tabs';
import type TabsType from '@theme/Tabs';
import type { WrapperProps } from '@docusaurus/types';
import { useTabCommentCounts } from '@site/src/components/Comments/tabCommentCounts';

type Props = WrapperProps<typeof TabsType>;
interface ItemProps { value?: string; attributes?: Record<string, unknown> }

export default function TabsWrapper(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const all = useTabCommentCounts();
  const group = ref.current?.firstElementChild;
  const counts = (group && all.get(group)) || undefined;
  const children = Children.map(props.children as ReactNode, (child) => {
    if (!isValidElement<ItemProps>(child) || typeof child.props.value !== 'string') return child;
    const n = counts?.[child.props.value] ?? 0;
    const attributes = {
      ...child.props.attributes,
      'data-tab-value': child.props.value,
      ...(n ? { 'data-comment-count': String(n), title: n === 1 ? '1 open comment' : `${n} open comments` } : {}),
    };
    return cloneElement(child as ReactElement<ItemProps>, { attributes });
  });
  return (
    <div ref={ref} data-platform-tabs="">
      <Tabs {...props}>{children}</Tabs>
    </div>
  );
}
