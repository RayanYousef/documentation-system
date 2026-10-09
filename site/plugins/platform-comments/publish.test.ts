import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listDocPages, publishComments } from './publish.mjs';

let dir = '';
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function site() {
  dir = await mkdtemp(path.join(tmpdir(), 'publish-comments-'));
  const put = async (rel: string, text: string) => { const p = path.join(dir, ...rel.split('/')); await mkdir(path.dirname(p), { recursive: true }); await writeFile(p, text); };
  await put('docs/index.md', '# Home');
  await put('docs/systems/inventory.md', '# Inventory');
  await put('docs/systems/crafting.mdx', '# Crafting');
  await put('docs/AGENTS.md', 'x');
  await put('docs/_draft.md', 'x');
  await put('docs/manifest.json', '{}');
  const thread = { id: 'c1', body: 'Why?', author: { login: 'mira', name: 'Mira' }, createdAt: '2026-10-09T10:00:00.000Z', status: 'open', replies: [], anchor: { exact: 'stored', prefix: '', suffix: '', tab: null } };
  await put('comments/systems/inventory.json', JSON.stringify({ schema: 1, page: 'systems/inventory.md', threads: [thread] }, null, 2));
  await put('comments/index.json', '{ not json');
  return { docsDir: path.join(dir, 'docs'), commentsDir: path.join(dir, 'comments'), outDir: path.join(dir, 'build', 'platform', 'comments') };
}

describe('publishing comments into the build', () => {
  it('lists the Latest doc pages Docusaurus renders', async () => {
    const s = await site();
    expect(await listDocPages(s.docsDir)).toEqual(['index.md', 'systems/crafting.mdx', 'systems/inventory.md']);
  });

  it('writes one file per page: its comments, or an empty file; a broken file is reported and published empty', async () => {
    const s = await site();
    const warnings: string[] = [];
    await publishComments({ ...s, warn: (m: string) => warnings.push(m) });
    const read = async (rel: string) => JSON.parse(await readFile(path.join(s.outDir, ...rel.split('/')), 'utf8'));
    expect((await read('systems/inventory.json')).threads.map((t: { body: string }) => t.body)).toEqual(['Why?']);
    expect(await read('systems/crafting.json')).toEqual({ schema: 1, page: 'systems/crafting.mdx', threads: [] });
    expect(await read('index.json')).toEqual({ schema: 1, page: 'index.md', threads: [] });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('not JSON');
  });
});
