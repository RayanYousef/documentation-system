// End-to-end tests of in-place editing against the built Docusaurus site (served by `docusaurus serve`).
// GitHub is mocked in the browser (site/e2e/support.ts): no network, no real credentials.
import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/live/**', // real-GitHub tests: `npm run e2e:live`, run by a person with their own token
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One retry everywhere: the tests that render WebGL (3D viewers on software GL) occasionally starve the page on a busy machine.
  retries: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/documentation-system/`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npm run build && npx docusaurus serve --port ${PORT} --host 127.0.0.1 --no-open`,
    env: { PLATFORM_BUILD_SHA: 'e2e-build-1' },
    url: `http://127.0.0.1:${PORT}/documentation-system/`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
