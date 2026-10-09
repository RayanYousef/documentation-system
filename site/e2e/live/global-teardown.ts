// Removes the local placeholder page that prepare.mjs wrote (whether the run passed or failed).
import { rmSync } from 'node:fs';
import path from 'node:path';

export default function globalTeardown(): void {
  const page = process.env.E2E_LIVE_PAGE;
  if (!page) return;
  rmSync(path.join(__dirname, '..', '..', 'docs', `${page}.md`), { force: true });
}
