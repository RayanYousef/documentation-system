// Component blocks in the page look: they render like the page (real admonitions, Infima tabs, real 3D
// viewers), their props are editable, new ones can be added, and saving writes the right MDX.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, save, fileOnMain, caretAfter, commitMessages, REPO_ROOT } from './support';

const editing = (page: Page) => page.locator('[data-platform-editing]');
const toolbarButton = (page: Page, label: string) => page.getByRole('toolbar', { name: 'Formatting' }).getByLabel(label, { exact: true });

/** Waits until a <model-viewer> reports its model as loaded. */
async function expectModelLoaded(viewer: Locator): Promise<void> {
  await viewer.scrollIntoViewIfNeeded();
  await expect.poll(() => viewer.evaluate((el) => (el as unknown as { loaded?: boolean }).loaded === true), { timeout: 30_000 }).toBe(true);
}

/** The model URL a <model-viewer> loads (React sets the `src` property, not the attribute). */
const modelSrc = (viewer: Locator) => expect.poll(() => viewer.evaluate((el) => (el as unknown as { src: string }).src));

/** Waits until an FBX viewer has a canvas and no loading or error overlay. */
async function expectFbxRendered(block: Locator): Promise<void> {
  await block.scrollIntoViewIfNeeded();
  await expect(block.locator('canvas')).toHaveCount(1);
  await expect(block).not.toContainText('Loading FBX');
  await expect(block).not.toContainText('Could not load');
}

/** Opens a viewer block's props popover and sets one prop. */
async function setViewerProp(page: Page, block: Locator, tag: string, prop: string, value: string): Promise<void> {
  await block.getByRole('button', { name: `${tag} settings` }).click();
  const input = page.getByLabel(`${tag} ${prop}`);
  await input.fill(value);
  await page.keyboard.press('Escape');
}

const viewerBlock = (page: Page, tag: string) => editing(page).locator(`[data-docs-block="${tag}"]`);

test('existing blocks render like the page: admonition, ModelViewer and FbxViewer; props edit and save', async ({ page, gh }) => {
  await openEditor(page, 'assets/airship-model');
  // The site's own Admonition component, editable inside.
  const adm = editing(page).locator('.theme-admonition');
  await expect(adm).toHaveCount(1);
  await adm.locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Typed in the note.');

  // The real viewers, at the page's height.
  const mv = viewerBlock(page, 'ModelViewer').locator('model-viewer');
  await modelSrc(mv).toBe('/documentation-system/models/cube.gltf');
  await expectModelLoaded(mv);
  await expectFbxRendered(viewerBlock(page, 'FbxViewer'));

  await setViewerProp(page, viewerBlock(page, 'ModelViewer'), 'ModelViewer', 'height', '400');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const text = fileOnMain(gh, 'site/docs/assets/airship-model.md')!;
  expect(text).toMatch(/:::note\n[\s\S]*Typed in the note\.[\s\S]*\n:::/);
  expect(text).toContain('<ModelViewer src="/models/cube.gltf" alt="Sample cube" height={400} />');
  expect(text).toContain('<FbxViewer repo="RayanYousef/documentation-system" ref="main" path="examples/unity-project/Assets/Models/Airship.fbx" alt="Airship" height={400} />');
});

test('add a 3D model by upload (glTF and FBX): committed to static/models, rendered at once, props editable, saved', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await caretAfter(page, 'Skyforge targets');

  // glTF -> ModelViewer
  let chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Insert 3D model (.glb, .gltf, .fbx)').click();
  await (await chooser).setFiles({ name: 'ship hull.gltf', mimeType: 'model/gltf+json', buffer: readFileSync(path.join(REPO_ROOT, 'site/static/models/torus.gltf')) });
  const added = viewerBlock(page, 'ModelViewer').locator('model-viewer');
  await expect(added).toHaveCount(1);
  await modelSrc(added).toMatch(/^blob:/); // not deployed yet: shown from the uploaded file
  await expectModelLoaded(added);
  expect(commitMessages(gh)[0]).toBe('Add 3D model ship-hull.gltf for getting-started.md');
  expect(gh.fileAt('main', 'site/static/models/ship-hull.gltf')).toContain('"asset"');
  await setViewerProp(page, viewerBlock(page, 'ModelViewer'), 'ModelViewer', 'alt', 'Ship hull');
  await setViewerProp(page, viewerBlock(page, 'ModelViewer'), 'ModelViewer', 'height', '360');

  // FBX -> FbxViewer
  await body(page).locator('p').first().click();
  chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Insert 3D model (.glb, .gltf, .fbx)').click();
  await (await chooser).setFiles({ name: 'crate.fbx', mimeType: 'application/octet-stream', buffer: readFileSync(path.join(REPO_ROOT, 'site/static/models/fbx/pyramid.fbx')) });
  await expect(viewerBlock(page, 'FbxViewer')).toHaveCount(1);
  await expectFbxRendered(viewerBlock(page, 'FbxViewer'));
  expect(gh.fileAt('main', 'site/static/models/fbx/crate.fbx')).not.toBeNull();

  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const text = fileOnMain(gh, 'site/docs/getting-started.md')!;
  expect(text).toContain('<ModelViewer src="/models/ship-hull.gltf" alt="Ship hull" height={360} />');
  expect(text).toContain('<FbxViewer src="/models/fbx/crate.fbx" alt="crate.fbx" />');
  // The saved preview renders the new models too.
  await expectModelLoaded(page.locator('[data-platform-saved-preview] model-viewer'));
});

test('add a 3D model from the repository and from the component menu; both render live and save', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await caretAfter(page, 'Skyforge targets');

  await toolbarButton(page, 'Insert from repo (existing models and images)').click();
  const picker = page.getByRole('dialog', { name: 'Insert from repo' });
  await picker.getByRole('button', { name: 'model: models/sphere.gltf' }).click();
  await expect(picker).toHaveCount(0);
  const fromRepo = viewerBlock(page, 'ModelViewer').locator('model-viewer');
  await modelSrc(fromRepo).toBe('/documentation-system/models/sphere.gltf');
  await expectModelLoaded(fromRepo);

  // Insert component -> FbxViewer with no source yet, then point it at a repo file.
  await body(page).locator('p').first().click();
  await toolbarButton(page, 'Insert component').click();
  await page.getByRole('menuitem', { name: 'FbxViewer' }).click();
  const fbx = viewerBlock(page, 'FbxViewer');
  await expect(fbx).toContainText('set src, or repo + path, to preview');
  await setViewerProp(page, fbx, 'FbxViewer', 'repo', 'RayanYousef/documentation-system');
  await setViewerProp(page, fbx, 'FbxViewer', 'path', 'examples/unity-project/Assets/Models/Chest.fbx');
  await expectFbxRendered(fbx);

  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const text = fileOnMain(gh, 'site/docs/getting-started.md')!;
  expect(text).toContain('<ModelViewer src="/models/sphere.gltf" alt="sphere.gltf" />');
  expect(text).toMatch(/<FbxViewer[^>]*repo="RayanYousef\/documentation-system"[^>]*path="examples\/unity-project\/Assets\/Models\/Chest\.fbx"[^>]*\/>/);
});

test('add Tabs: Infima tabs render, one panel at a time; tabs and labels are editable; saved as Tabs/TabItem', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await caretAfter(page, 'Skyforge targets');
  await toolbarButton(page, 'Insert tabs').click();

  const tabs = editing(page).locator('.tabs-container');
  await expect(tabs).toHaveCount(1);
  const items = tabs.locator('ul.tabs > li.tabs__item');
  await expect(items).toHaveCount(2);
  await expect(tabs.locator('li.tabs__item--active')).toHaveCount(1);
  await items.nth(0).click();
  await expect(items.nth(0)).toHaveClass(/tabs__item--active/);
  const panels = tabs.locator('[role="tabpanel"]');
  await expect(panels.nth(0)).toBeVisible();
  await expect(panels.nth(1)).toBeHidden();

  // Type in the first tab, switch, type in the second.
  await panels.nth(0).locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' for Windows');
  await items.nth(1).click();
  await expect(panels.nth(1)).toBeVisible();
  await expect(panels.nth(0)).toBeHidden();
  await panels.nth(1).locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' for Linux');

  // Props: double-click a tab to edit it; the gear edits the Tabs props.
  await items.nth(1).dblclick();
  await page.getByLabel('TabItem label').fill('Linux');
  await page.getByLabel('TabItem value').fill('linux');
  await tabs.getByRole('button', { name: 'Done' }).click();
  await expect(items.nth(1)).toHaveText('Linux');
  await tabs.getByRole('button', { name: 'Tabs settings' }).click();
  await page.getByLabel('Tabs groupId').fill('os');
  await tabs.getByRole('button', { name: 'Done' }).click();

  // Add a third tab.
  await tabs.getByRole('button', { name: 'Add tab' }).click();
  await expect(items).toHaveCount(3);
  await expect(items.nth(2)).toHaveClass(/tabs__item--active/);

  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const text = fileOnMain(gh, 'site/docs/getting-started.md')!;
  expect(text).toMatch(/<Tabs groupId="os">\n {2}<TabItem [^>]*>\n[\s\S]*for Windows[\s\S]*<TabItem value="linux" label="Linux">\n[\s\S]*for Linux[\s\S]*<\/TabItem>\n<\/Tabs>/);
  // The saved preview shows the same tabs.
  await expect(page.locator('[data-platform-saved-preview] .tabs-container ul.tabs > li')).toHaveCount(3);
});

test('the "/" menu inserts blocks (an admonition and a ModelViewer)', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/tip');
  await page.getByRole('option', { name: 'Admonition (:::tip)' }).click();
  await page.keyboard.type('Slash tip text.');
  await expect(editing(page).locator('.theme-admonition-tip')).toContainText('Slash tip text.');

  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/ModelViewer');
  await page.getByRole('option', { name: 'ModelViewer' }).click();
  const block = viewerBlock(page, 'ModelViewer');
  await setViewerProp(page, block, 'ModelViewer', 'src', '/models/cone.gltf');
  const mv = block.locator('model-viewer');
  await modelSrc(mv).toBe('/documentation-system/models/cone.gltf');
  await expectModelLoaded(mv);

  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const text = fileOnMain(gh, 'site/docs/getting-started.md')!;
  expect(text).toMatch(/:::tip\nSlash tip text\.\n:::/);
  expect(text).toContain('<ModelViewer src="/models/cone.gltf" />');
});
