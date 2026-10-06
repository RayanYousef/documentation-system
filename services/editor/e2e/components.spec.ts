// Docs components: 3D models and images (upload and from the repo), viewer blocks with editable props, Tabs.
// The saved Markdown must use the same tags and src formats the editor wrote before the Plate change:
// uploaded and repo models keep a site-relative src, images get the base url.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { expect, git, newParagraphAtEnd, openPage, richBody, saveAndRead, seedPage, siteFile, signIn, test, tool, unsaved } from './support.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticFile = (rel: string) => readFile(path.join(here, '../../../site/static', ...rel.split('/')));
const suffix = () => Math.random().toString(36).slice(2, 7);

async function openSeeded(page: Page, slug: string, body: string): Promise<string> {
  const pagePath = await seedPage(slug, body);
  await signIn(page);
  await openPage(page, pagePath);
  await expect(richBody(page)).toBeVisible();
  return pagePath;
}

/** Clicks a toolbar button that opens a file chooser and hands it a file. */
async function upload(page: Page, button: string, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await tool(page, button).click();
  await (await chooser).setFiles(file);
}

const viewerBlock = (page: Page, tag: string): Locator => richBody(page).locator(`[data-docs-block="${tag}"]`);

test('3D model upload: a .gltf and an .fbx are committed and inserted as ModelViewer / FbxViewer', async ({ page }) => {
  const pagePath = await openSeeded(page, 'model-upload', 'Intro.\n');
  const gltf = `probe-${suffix()}.gltf`;
  const fbx = `probe-${suffix()}.fbx`;
  await newParagraphAtEnd(page);

  await upload(page, 'Insert 3D model (.glb, .gltf, .fbx)', { name: gltf, mimeType: 'model/gltf+json', buffer: await staticFile('models/cube.gltf') });
  await expect(viewerBlock(page, 'ModelViewer')).toBeVisible();
  expect(await git('log', '-1', '--format=%an %s')).toBe(`Mock Editor Add 3D model ${gltf} for ${pagePath}`);
  expect(await siteFile(`static/models/${gltf}`)).toBe((await staticFile('models/cube.gltf')).toString('utf8'));

  await upload(page, 'Insert 3D model (.glb, .gltf, .fbx)', { name: fbx, mimeType: 'application/octet-stream', buffer: await staticFile('models/fbx/cube.fbx') });
  await expect(viewerBlock(page, 'FbxViewer')).toBeVisible();
  expect(await git('log', '-1', '--format=%s')).toBe(`Add 3D model ${fbx} for ${pagePath}`);
  await expect(unsaved(page)).toBeVisible();

  expect(await saveAndRead(page, pagePath, 'Add models')).toBe(
    `\nIntro.\n\n<ModelViewer src="/models/${gltf}" alt="${gltf}" />\n\n<FbxViewer src="/models/fbx/${fbx}" alt="${fbx}" />\n`,
  );
});

test('image upload, and a model and an image picked from the repo, keep the old src formats', async ({ page }) => {
  const pagePath = await openSeeded(page, 'repo-assets', 'Intro.\n');
  const shot = `shot-${suffix()}.png`;
  await newParagraphAtEnd(page);

  // Upload an image: committed under uploads/, inserted with the base url and the file name as alt.
  await upload(page, 'Upload image', { name: shot, mimeType: 'image/png', buffer: await staticFile('img/logo.png') });
  const uploaded = richBody(page).getByRole('img', { name: shot });
  await expect(uploaded).toHaveAttribute('src', `/CloudDocumentationPersonal/uploads/${shot}`);
  await expect.poll(() => uploaded.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await git('log', '-1', '--format=%s')).toBe(`Add image ${shot} for ${pagePath}`);

  // Insert from repo: the dialog lists what is committed under static/.
  await tool(page, 'Insert from repo (existing models and images)').click();
  const dialog = page.getByRole('dialog', { name: 'Insert from repo' });
  await dialog.getByRole('button', { name: 'model: models/cube.gltf' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(viewerBlock(page, 'ModelViewer')).toBeVisible();

  await tool(page, 'Insert from repo (existing models and images)').click();
  await expect(dialog.getByRole('button', { name: `image: uploads/${shot}` })).toBeVisible();
  await dialog.getByRole('button', { name: 'image: img/logo.png' }).click();
  await expect(richBody(page).getByRole('img', { name: 'img/logo.png' })).toHaveAttribute('src', '/CloudDocumentationPersonal/img/logo.png');

  expect(await saveAndRead(page, pagePath, 'Add assets')).toBe([
    '', 'Intro.', '',
    `![${shot}](/CloudDocumentationPersonal/uploads/${shot})`, '',
    '<ModelViewer src="/models/cube.gltf" alt="cube.gltf" />', '',
    '![img/logo.png](/CloudDocumentationPersonal/img/logo.png)', '',
  ].join('\n'));
});

test('a ModelViewer block shows its preview, its props can be edited, and typing in a prop does not reach the text', async ({ page }) => {
  const pagePath = await openSeeded(page, 'viewer-props', 'Before the model.\n\n<ModelViewer src="/models/cube.gltf" alt="Sample cube" height={320} />\n\nAfter the model.\n');
  const block = viewerBlock(page, 'ModelViewer');

  // The preview loads the model from the site, at the height the page asks for.
  const viewer = block.locator('model-viewer');
  // React sets src and alt on <model-viewer> as properties, so read the properties.
  const prop = (name: 'src' | 'alt') => viewer.evaluate((el, n) => (el as HTMLElement & Record<string, unknown>)[n], name);
  await expect.poll(() => prop('src')).toBe('/CloudDocumentationPersonal/models/cube.gltf');
  await expect(viewer).toHaveCSS('height', '320px');
  await viewer.scrollIntoViewIfNeeded(); // model-viewer loads once it is on screen
  await expect.poll(() => viewer.evaluate((el) => (el as HTMLElement & { loaded?: boolean }).loaded === true)).toBe(true);
  await expect(unsaved(page)).toHaveCount(0);

  // Keys typed in a prop input edit the prop only: Backspace, Enter and letters never touch the page text.
  const alt = page.getByLabel('ModelViewer alt');
  await alt.click();
  await alt.press('End');
  for (let i = 0; i < 4; i++) await alt.press('Backspace');
  await alt.pressSequentially('box');
  await alt.press('Enter');
  await expect(alt).toHaveValue('Sample box');
  await expect.poll(() => prop('alt')).toBe('Sample box');
  await expect(richBody(page)).toContainText('Before the model.');
  await expect(richBody(page)).toContainText('After the model.');
  await expect(richBody(page)).not.toContainText('box');
  await expect(block).toHaveCount(1);

  const height = page.getByLabel('ModelViewer height');
  await height.fill('240');
  await expect(viewer).toHaveCSS('height', '240px');
  await page.getByLabel('ModelViewer src').fill('/models/sphere.gltf');
  await expect.poll(() => prop('src')).toBe('/CloudDocumentationPersonal/models/sphere.gltf');
  await expect(unsaved(page)).toBeVisible();

  expect(await saveAndRead(page, pagePath, 'Edit viewer props')).toBe(
    '\nBefore the model.\n\n<ModelViewer src="/models/sphere.gltf" alt="Sample box" height={240} />\n\nAfter the model.\n',
  );
});

test('an FbxViewer block renders its preview, and clearing its src shows the empty-preview hint', async ({ page }) => {
  const pagePath = await openSeeded(page, 'fbx-props', '<FbxViewer src="/models/fbx/pyramid.fbx" alt="Pyramid" height={300} />\n');
  const block = viewerBlock(page, 'FbxViewer');
  await expect(block.locator('canvas')).toBeVisible();
  await expect(block.getByText('Loading FBX...')).toHaveCount(0);
  await expect(block.getByText('Could not load FBX')).toHaveCount(0);

  await page.getByLabel('FbxViewer src').fill('');
  await expect(block.getByText('Set src, or repo + path, to preview.')).toBeVisible();
  await page.getByLabel('FbxViewer repo').fill('RayanYousef/CloudDocumentationPersonal');
  await page.getByLabel('FbxViewer path').fill('examples/unity-project/Assets/Models/Airship.fbx');

  expect(await saveAndRead(page, pagePath, 'Point viewer at the code repo')).toBe(
    '\n<FbxViewer repo="RayanYousef/CloudDocumentationPersonal" path="examples/unity-project/Assets/Models/Airship.fbx" alt="Pyramid" height={300} />\n',
  );
});

test('tabs: insert, add a tab, type inside a tab; saved as Tabs / TabItem', async ({ page }) => {
  const pagePath = await openSeeded(page, 'tabs', 'Intro.\n');
  await newParagraphAtEnd(page);
  await tool(page, 'Insert tabs').click();
  const tabs = richBody(page).locator('.slate-tabs');
  await expect(page.getByLabel('TabItem value')).toHaveCount(2);
  await expect(page.getByLabel('TabItem value').first()).toHaveValue('one');
  await expect(page.getByLabel('TabItem default').first()).toBeChecked();

  // Type inside the first tab, after its text.
  await richBody(page).getByText('First tab').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' with more text');
  await expect(richBody(page).getByText('First tab with more text')).toBeVisible();

  // Add a third tab and write in it.
  await richBody(page).getByRole('button', { name: 'Add tab' }).click();
  await expect(page.getByLabel('TabItem value')).toHaveCount(3);
  await expect(page.getByLabel('TabItem value').nth(2)).toHaveValue('tab3');
  await page.keyboard.type('Third tab body');
  await page.getByLabel('TabItem label').nth(2).fill('Linux');
  await page.getByLabel('Tabs groupId').fill('os');
  await expect(tabs).toHaveCount(1);

  expect(await saveAndRead(page, pagePath, 'Add tabs')).toBe([
    '', 'Intro.', '',
    '<Tabs groupId="os">',
    '  <TabItem value="one" label="One" default>',
    '    First tab with more text',
    '  </TabItem>', '',
    '  <TabItem value="two" label="Two">',
    '    Second tab',
    '  </TabItem>', '',
    '  <TabItem value="tab3" label="Linux">',
    '    Third tab body',
    '  </TabItem>',
    '</Tabs>', '',
  ].join('\n'));
});

test('insert component: the FbxViewer item inserts a viewer block whose props are saved', async ({ page }) => {
  const pagePath = await openSeeded(page, 'insert-component', 'Intro.\n');
  await newParagraphAtEnd(page);
  await tool(page, 'Insert component').click();
  await page.getByRole('menuitem', { name: '<FbxViewer />' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(viewerBlock(page, 'FbxViewer')).toBeVisible();
  await page.getByLabel('FbxViewer src').fill('/models/fbx/pyramid.fbx');
  await expect(viewerBlock(page, 'FbxViewer').locator('canvas')).toBeVisible();

  expect(await saveAndRead(page, pagePath, 'Insert component')).toBe('\nIntro.\n\n<FbxViewer src="/models/fbx/pyramid.fbx" />\n');
});
