import { test, expect, openEditor, button, body, save, fileOnMain, commitOnMain, editStatus } from './support';

test('Raw shows the whole file in CodeMirror; edits there show in Visual and are saved', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await button(page, 'Raw').click();
  const cm = page.locator('.cm-content');
  await expect(cm).toContainText('title: Getting Started');
  await expect(cm).toContainText('description:');
  await cm.locator('.cm-line', { hasText: 'title: Getting Started' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Guide');
  await button(page, 'Visual').click();
  await expect(page.getByLabel('Page title')).toHaveValue('Getting Started Guide');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  expect(fileOnMain(gh, 'site/docs/getting-started.md')).toContain('title: Getting Started Guide\n');
  void body;
});

test('a page the visual editor cannot open safely opens in Raw with the reason', async ({ page, gh }) => {
  const path = 'site/docs/getting-started.md';
  await commitOnMain(gh, path, fileOnMain(gh, path)!.replace(/\n---\n/, '\n---\n\nimport Thing from "./thing";\n'));
  await page.goto('getting-started');
  await page.getByTestId('inplace-edit-button').click();
  await page.getByLabel('GitHub token').fill('good-token');
  await button(page, 'Sign in').click();
  await expect(page.locator('.cm-content')).toContainText('import Thing from');
  await expect(editStatus(page)).toContainText('could not be opened in the visual editor; editing raw MDX instead');
  await expect(page.locator('[data-slate-editor]')).toHaveCount(0);
});
