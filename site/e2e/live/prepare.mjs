// Runs before the live test builds the site. The site is built from this checkout, so a page the test creates on
// GitHub has no route in it. To be able to open that page in the editor, a placeholder page with the same name
// is written into site/docs for the duration of the run (global-teardown.ts removes it again). The placeholder is
// only a local file; it is never committed.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const page = process.env.E2E_LIVE_PAGE;
if (!page) { console.error('E2E_LIVE_PAGE is not set (it comes from playwright.live.config.ts).'); process.exit(1); }

writeFileSync(path.join(siteDir, 'docs', `${page}.md`), [
  '---',
  'title: E2E live test',
  'description: A temporary page for the live end-to-end test; this local copy only gives the editor a route.',
  'type: guide',
  'sidebar_position: 99',
  '---',
  '',
  'Placeholder for the live end-to-end test.',
  '',
].join('\n'));
console.log(`live e2e: wrote the local placeholder docs/${page}.md`);
