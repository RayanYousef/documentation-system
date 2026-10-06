// Folder intros (index.md): only the hand-written part is editable; the generated okf block stays as it is.
import { splitFolderIntro } from '../src/mdx/folderIntro.js';
import { appStatus, docFile, expect, git, signIn, test } from './support.js';

test('edit a folder intro and save it; the generated okf block is untouched', async ({ page }) => {
  const indexPath = 'decisions/index.md';
  const before = splitFolderIntro(await docFile(indexPath));
  expect(before.generated).toContain('<!-- okf:index -->');

  await signIn(page, 'Intro Writer');
  await page.getByRole('button', { name: indexPath, exact: true }).click();
  const intro = page.getByLabel('Folder intro');
  await expect(intro).toHaveValue(before.before);
  // The generated block is shown, read-only, and is not part of the text box.
  await expect(page.getByText('<!-- okf:index -->')).toBeVisible();
  await expect(intro).not.toHaveValue(/okf:index/);
  const saveIntro = page.getByRole('button', { name: 'Save intro' });
  await expect(saveIntro).toBeDisabled();

  const added = 'Start with the newest record when you are new to the project.';
  await intro.fill(before.before.replace(/\n+$/, `\n\n${added}\n\n`));
  await saveIntro.click();
  await expect(appStatus(page)).toContainText('Committed');
  expect(await git('log', '-1', '--format=%an %s')).toBe(`Intro Writer Update ${indexPath} intro`);

  const after = splitFolderIntro(await docFile(indexPath));
  expect(after.before).toBe(before.before.replace(/\n+$/, `\n\n${added}\n\n`));
  expect(after.generated).toBe(before.generated);
  expect(after.after).toBe(before.after);
});
