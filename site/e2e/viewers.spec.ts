// Readers: every 3D viewer on the doc pages loads and renders, from the right URLs, without 404s or
// console errors (the console guard in support.ts fails the test on any error).
import { test, expect } from './support';

for (const route of ['assets/airship-model', 'assets/forge-props']) {
  test(`3D viewers on ${route} render`, async ({ page, gh: _gh }) => {
    const failures: string[] = [];
    const modelRequests: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    page.on('request', (r) => { if (/\.(gltf|glb|fbx)(\?|$)/i.test(r.url())) modelRequests.push(r.url()); });
    await page.goto(route);

    const viewers = page.locator('article model-viewer');
    for (let i = 0; i < await viewers.count(); i++) {
      const v = viewers.nth(i);
      await v.scrollIntoViewIfNeeded();
      expect(await v.evaluate((el) => (el as unknown as { src: string }).src)).toMatch(/^\/documentation-system\/models\//);
      await expect.poll(() => v.evaluate((el) => (el as unknown as { loaded?: boolean }).loaded === true), { timeout: 30_000 }).toBe(true);
    }
    const canvases = page.locator('article canvas');
    await expect(canvases).not.toHaveCount(0);
    for (let i = 0; i < await canvases.count(); i++) {
      const box = canvases.nth(i).locator('xpath=../..');
      await box.scrollIntoViewIfNeeded();
      await expect(box).not.toContainText('Loading FBX');
      await expect(box).not.toContainText('Could not load');
    }
    await expect(page.locator('article')).not.toContainText('Model unavailable');
    expect(modelRequests.length).toBeGreaterThan(0);
    for (const u of modelRequests) expect(u).toMatch(/^(http:\/\/127\.0\.0\.1:\d+\/documentation-system\/models\/|https:\/\/raw\.githubusercontent\.com\/RayanYousef\/documentation-system\/)/);
    expect(failures).toEqual([]);
  });
}
