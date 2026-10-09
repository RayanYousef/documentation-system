// Raw mode round trip: switching Visual -> Raw -> Visual (several times) must not change a single character of
// the page. Checked on pages that hold admonitions, code, links, tables, tabs and viewers: the only difference
// in the saved file is the one edit made on purpose.
import { test, expect, openEditor, button, body, save, fileOnMain, caretAfter } from './support';

const PAGES: [route: string, file: string, titleLine: RegExp][] = [
  ['getting-started', 'site/docs/getting-started.md', /^title: .*$/m],
  ['assets/airship-model', 'site/docs/assets/airship-model.md', /^title: .*$/m],
  ['systems/inventory', 'site/docs/systems/inventory.md', /^title: .*$/m],
  ['platform/architecture', 'site/docs/platform/architecture.md', /^title: .*$/m],
];

for (const [route, file, titleLine] of PAGES) {
  test(`${route}: Visual to Raw and back three times changes nothing; one deliberate edit is the only difference`, async ({ page, gh }) => {
    const original = fileOnMain(gh, file)!;
    await openEditor(page, route);
    for (let i = 0; i < 3; i++) {
      await button(page, 'Raw').click();
      await expect(page.locator('.cm-content')).toBeVisible();
      await button(page, 'Visual').click();
      await expect(body(page)).toBeVisible();
    }
    // The deliberate edit: the title field.
    const title = page.getByLabel('Page title');
    const oldTitle = await title.inputValue();
    await title.fill(`${oldTitle} (round trip)`);
    await save(page);
    await expect(page.getByTestId('saved-banner')).toBeVisible();

    const saved = fileOnMain(gh, file)!;
    expect(saved.match(titleLine)![0]).toContain('(round trip)');
    // Apart from the title line, the file is the original, character for character.
    expect(saved.replace(titleLine, 'title: X')).toBe(original.replace(titleLine, 'title: X'));
  });
}

test('typing in Visual, then Raw, then Visual keeps the typed text; Raw edits show up in Visual', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Typed in visual mode.');
  await button(page, 'Raw').click();
  const cm = page.locator('.cm-content');
  await expect(cm).toContainText('Typed in visual mode.');
  await cm.locator('.cm-line', { hasText: 'Typed in visual mode.' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' And typed in raw mode.');
  await button(page, 'Visual').click();
  await expect(body(page).locator('p', { hasText: 'Typed in visual mode. And typed in raw mode.' })).toHaveCount(1);
  await button(page, 'Raw').click();
  await expect(cm).toContainText('Typed in visual mode. And typed in raw mode.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  expect(fileOnMain(gh, 'site/docs/getting-started.md')).toContain('Typed in visual mode. And typed in raw mode.');
});

test('a page that holds frontmatter, a table, code, a link and an admonition survives Raw untouched', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await button(page, 'Raw').click();
  const cm = page.locator('.cm-content');
  await cm.locator('.cm-line', { hasText: '## Prerequisites' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const extra = ['| Name | Qty |', '|---|---|', '| Sword | 1 |', '', '```csharp', 'var x = 1;', '```', '', ':::tip', 'Raw tip with a [link](https://example.com/raw).', ':::'];
  for (const line of extra) { if (line) await page.keyboard.insertText(line); await page.keyboard.press('Enter'); }
  await button(page, 'Visual').click();
  await expect(body(page).locator('table')).toHaveCount(1);
  await expect(body(page).locator('.docs-code-block', { hasText: 'var x = 1;' })).toHaveCount(1);
  await expect(body(page).locator('.theme-admonition-tip a[href="https://example.com/raw"]')).toHaveCount(1);
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const text = fileOnMain(gh, 'site/docs/getting-started.md')!;
  expect(text).toContain('| Sword | 1 |');
  expect(text).toContain('```csharp\nvar x = 1;\n```');
  expect(text).toContain(':::tip\nRaw tip with a [link](https://example.com/raw).\n:::');
});
