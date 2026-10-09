// End-to-end tests against the Docusaurus DEV server (`npm start`), where in-place editing writes to the working
// tree instead of committing. Kept apart from playwright.config.ts (built site, GitHub mocked) because the dev
// server is slow to start and its tests touch real files; they snapshot site/docs first and put it back after.
import { defineConfig, devices } from '@playwright/test';

const PORT = 3211;

export default defineConfig({
  testDir: './e2e-dev',
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/documentation-system/`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npm run start -- --port ${PORT} --host 127.0.0.1 --no-open`,
    url: `http://127.0.0.1:${PORT}/documentation-system/`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
