// 3D models beyond blocks.spec.ts: a .glb upload (binary glTF), size and text settings of both viewers, and a model
// picked from the repo, each saved, reloaded and read back. (.gltf and .fbx uploads, picking from the repo and
// the Insert component menu are in blocks.spec.ts; models inside a tab are in tabs.spec.ts.)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit, commitMessages, REPO_ROOT, editing } from './support';

const PAGE = 'site/docs/getting-started.md';

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

const viewerBlock = (page: Page, tag: string) => editing(page).locator(`[data-docs-block="${tag}"]`);

/** A binary glTF (.glb) built from a .gltf of the repo: the same JSON in the JSON chunk. */
function makeGlb(gltfFile: string): Buffer {
  const json = Buffer.from(readFileSync(gltfFile, 'utf8'));
  const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + padded.length, 8);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(padded.length, 0);
  chunk.write('JSON', 4, 'ascii');
  return Buffer.concat([header, chunk, padded]);
}

async function expectModelLoaded(viewer: Locator): Promise<void> {
  await viewer.scrollIntoViewIfNeeded();
  await expect.poll(() => viewer.evaluate((el) => (el as unknown as { loaded?: boolean }).loaded === true), { timeout: 30_000 }).toBe(true);
}

async function expectFbxRendered(block: Locator): Promise<void> {
  await block.scrollIntoViewIfNeeded();
  await expect(block.locator('canvas')).toHaveCount(1, { timeout: 60_000 }); // three.js and the FBX parser load on first use; slow on a busy machine
  await expect(block).not.toContainText('Loading FBX');
  await expect(block).not.toContainText('Could not load');
}

async function setProp(page: Page, block: Locator, tag: string, prop: string, value: string): Promise<void> {
  await block.getByRole('button', { name: `${tag} settings` }).click();
  await page.getByLabel(`${tag} ${prop}`).fill(value);
  await page.keyboard.press('Escape');
}

test('upload a .glb model: committed as models/<name>.glb, shown at once, saved as a ModelViewer and read back', async ({ page, gh, consoleGuard }) => {
  // After the reload the site (not deployed yet) answers 404 for the new file; the editor then reads it from GitHub.
  consoleGuard.allow(/Failed to load resource: the server responded with a status of 404|fetch for .*\/models\/cargo-bay\.glb.* responded with 404/);
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  const chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Insert 3D model (.glb, .gltf, .fbx)').click();
  await (await chooser).setFiles({ name: 'cargo bay.glb', mimeType: 'model/gltf-binary', buffer: makeGlb(path.join(REPO_ROOT, 'site/static/models/torus.gltf')) });

  const viewer = viewerBlock(page, 'ModelViewer').locator('model-viewer');
  await expect(viewer).toHaveCount(1);
  await expectModelLoaded(viewer);
  expect(commitMessages(gh)[0]).toBe('Add 3D model cargo-bay.glb for getting-started.md');
  expect(gh.fileAt('main', 'site/static/models/cargo-bay.glb')).toMatch(/^glTF/);

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('<ModelViewer src="/models/cargo-bay.glb" alt="cargo-bay.glb" />');
  await expect(viewerBlock(page, 'ModelViewer')).toHaveCount(1);
  // Not deployed yet, so the site has no copy: the viewer must still load the model (from GitHub).
  await expectModelLoaded(viewerBlock(page, 'ModelViewer').locator('model-viewer'));
});

test('size and text settings of a ModelViewer: height and alt are written, and clearing the height removes it', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert from repo (existing models and images)').click();
  await page.getByRole('dialog', { name: 'Insert from repo' }).getByRole('button', { name: 'model: models/cone.gltf' }).click();
  const block = viewerBlock(page, 'ModelViewer');
  await expectModelLoaded(block.locator('model-viewer'));

  await setProp(page, block, 'ModelViewer', 'height', '520');
  await setProp(page, block, 'ModelViewer', 'alt', 'A traffic cone');
  const box = await block.locator('model-viewer').boundingBox();
  expect(Math.round(box!.height)).toBe(520);

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('<ModelViewer src="/models/cone.gltf" alt="A traffic cone" height={520} />');

  // Open again: the settings are read back, and clearing the height drops the prop on the next save.
  await setProp(page, viewerBlock(page, 'ModelViewer'), 'ModelViewer', 'height', '');
  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('<ModelViewer src="/models/cone.gltf" alt="A traffic cone" />');
});

test('size and text settings of an FbxViewer: height and alt are written; a repo FBX is picked from the list', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert from repo (existing models and images)').click();
  await page.getByRole('dialog', { name: 'Insert from repo' }).getByRole('button', { name: 'model: models/fbx/cube.fbx' }).click();
  const block = viewerBlock(page, 'FbxViewer');
  await expectFbxRendered(block);

  await setProp(page, block, 'FbxViewer', 'height', '300');
  await setProp(page, block, 'FbxViewer', 'alt', 'FBX cube');
  const box = await block.locator('canvas').boundingBox();
  expect(Math.round(box!.height)).toBe(300);

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('<FbxViewer src="/models/fbx/cube.fbx" alt="FBX cube" height={300} />');
  await expectFbxRendered(viewerBlock(page, 'FbxViewer'));
  void body;
});
