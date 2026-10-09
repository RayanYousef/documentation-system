// "Page look": the same plugins (same Markdown rules, input rules, normalizers), rendered with the
// page-look components so a page being edited looks like the rendered page. A plugin whose key is not
// listed keeps its component.
import type { ComponentType } from 'react';
import { KEYS, type AnyPluginConfig } from 'platejs';
import { DOCS_KEYS } from '../nodes/keys.js';
import { PageCalloutElement } from '../page/PageCalloutElement.js';
import { PageCodeBlockElement } from '../page/PageCodeBlockElement.js';
import { PageOkfGeneratedElement } from '../page/PageOkfGeneratedElement.js';
import { PageTabItemElement, PageTabsElement } from '../page/PageTabsElement.js';
import { PageBlockquoteElement, PageH1Element, PageH2Element, PageH3Element, PageH4Element, PageH5Element, PageH6Element, PageHrElement, PageParagraphElement } from '../page/PageTextElements.js';
import { PageViewerElement } from '../page/PageViewerElement.js';

/** Plugin key -> page-look component. */
export const PAGE_LOOK_COMPONENTS: Readonly<Record<string, ComponentType<never>>> = {
  [KEYS.p]: PageParagraphElement,
  [KEYS.h1]: PageH1Element,
  [KEYS.h2]: PageH2Element,
  [KEYS.h3]: PageH3Element,
  [KEYS.h4]: PageH4Element,
  [KEYS.h5]: PageH5Element,
  [KEYS.h6]: PageH6Element,
  [KEYS.blockquote]: PageBlockquoteElement,
  [KEYS.hr]: PageHrElement,
  [KEYS.codeBlock]: PageCodeBlockElement,
  [KEYS.callout]: PageCalloutElement,
  [DOCS_KEYS.tabs]: PageTabsElement,
  [DOCS_KEYS.tabItem]: PageTabItemElement,
  [DOCS_KEYS.modelViewer]: PageViewerElement,
  [DOCS_KEYS.fbxViewer]: PageViewerElement,
  [DOCS_KEYS.okfGenerated]: PageOkfGeneratedElement,
};

interface Extendable { key: string; extend?: (config: () => { node: { component: ComponentType<never> }; render: { node: ComponentType<never> } }) => AnyPluginConfig }

/**
 * Pure: returns new plugins; the input list is not changed. The component is set as an extension (a
 * function), which Plate applies after the plugin's own `configure({ node: { component } })`; the object
 * form of `withComponent` is merged before it and would lose to the configured component.
 */
export function withPageLook<T extends AnyPluginConfig>(plugins: readonly T[]): AnyPluginConfig[] {
  return plugins.map((p) => {
    const component = PAGE_LOOK_COMPONENTS[p.key];
    const plugin = p as unknown as Extendable;
    return component && plugin.extend ? plugin.extend(() => ({ node: { component }, render: { node: component } })) : p;
  });
}
