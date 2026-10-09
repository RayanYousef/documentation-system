// Tabs on the page (Docusaurus <Tabs>, and the editor's saved preview, which uses the same Infima markup):
// `.tabs-container` > `[role=tablist] > [role=tab]` and, in the same order, `[role=tabpanel]`.
// A tab's value is its `data-tab-value` attribute (set by the site's Tabs wrapper), else its label.
import type { CommentTab } from '@platform/contracts';

const GROUP = '.tabs-container';

const ownedBy = (group: Element) => (el: Element) => el.closest(GROUP) === group;
const tabsOf = (group: Element): Element[] => Array.from(group.querySelectorAll('[role="tab"]')).filter(ownedBy(group));
const panelsOf = (group: Element): Element[] => Array.from(group.querySelectorAll('[role="tabpanel"]')).filter(ownedBy(group));

/** The label a reader sees (the comment-count badge is CSS-generated, so it is not part of the text). */
export const tabLabel = (tab: Element): string => (tab.textContent ?? '').replace(/\s+/g, ' ').trim();
const tabValue = (tab: Element): string => tab.getAttribute('data-tab-value') ?? tabLabel(tab);

export const tabGroups = (root: Element): Element[] => Array.from(root.querySelectorAll(GROUP));

export interface PanelInfo { group: Element; tab: CommentTab }

/** The innermost tab panel holding `node`, with its group and tab, or null when the node is not in a tab. */
export function tabOf(root: Element, node: Node): PanelInfo | null {
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  const panel = el?.closest('[role="tabpanel"]');
  const group = panel?.closest(GROUP);
  if (!panel || !group || !root.contains(group)) return null;
  const index = panelsOf(group).indexOf(panel);
  const tab = tabsOf(group)[index];
  if (index < 0 || !tab) return null;
  return { group, tab: { group: tabGroups(root).indexOf(group), value: tabValue(tab), label: tabLabel(tab) } };
}

/** The panel of a stored tab: its group first, then any group that has a tab with that value (or label). */
export function panelOf(root: Element, tab: CommentTab): Element | null {
  const groups = tabGroups(root);
  const ordered = [groups[tab.group], ...groups.filter((_, i) => i !== tab.group)].filter((g): g is Element => !!g);
  for (const group of ordered) {
    const tabs = tabsOf(group);
    let i = tabs.findIndex((t) => tabValue(t) === tab.value);
    if (i < 0) i = tabs.findIndex((t) => tabLabel(t) === tab.label);
    const panel = i >= 0 ? panelsOf(group)[i] : undefined;
    if (panel) return panel;
  }
  return null;
}

/** The tab element (the label) that shows `panel`. */
export function tabElementFor(panel: Element): HTMLElement | null {
  const group = panel.closest(GROUP);
  if (!group) return null;
  return (tabsOf(group)[panelsOf(group).indexOf(panel)] as HTMLElement | undefined) ?? null;
}
