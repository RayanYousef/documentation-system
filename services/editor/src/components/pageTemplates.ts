// What a new page starts with (the "New page" dialog's Template choice). A template is data: a new one is a
// new entry in PAGE_TEMPLATES; the dialog does not change. Bodies are written exactly as the visual editor
// writes them, so a new page opens in the visual editor and saves back unchanged.

export interface PageTemplate {
  id: string;
  /** Shown in the dialog. */
  label: string;
  /** One sentence under the choice. */
  hint: string;
  /** The page body (after the frontmatter) for a page with this title. */
  body(title: string): string;
}

export const BLANK_PAGE: PageTemplate = {
  id: 'blank',
  label: 'Blank',
  hint: 'A title and one paragraph.',
  body: (title) => `\n# ${title}\n\nWrite the page here.\n`,
};

const tab = (value: string, label: string, text: string, isDefault = false) =>
  `  <TabItem value="${value}" label="${label}"${isDefault ? ' default' : ''}>\n    ${text}\n  </TabItem>`;

/** A feature page: a title and three tabs (How to use, API, Misc), each with a short placeholder line. */
export const FEATURE_PAGE: PageTemplate = {
  id: 'feature',
  label: 'Feature page',
  hint: 'A title and the tabs How to use, API and Misc.',
  body: (title) => [
    '',
    `# ${title}`,
    '',
    '<Tabs>',
    tab('how-to-use', 'How to use', 'Explain how to use this feature, step by step.', true),
    '',
    tab('api', 'API', 'List the classes, methods and settings of this feature.'),
    '',
    tab('misc', 'Misc', 'Anything else: limits, tips and related pages.'),
    '</Tabs>',
    '',
  ].join('\n'),
};

export const PAGE_TEMPLATES: readonly PageTemplate[] = [BLANK_PAGE, FEATURE_PAGE];
