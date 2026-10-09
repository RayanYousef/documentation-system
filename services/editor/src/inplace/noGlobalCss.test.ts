// @vitest-environment node
// The site's bundler merges every `.css` import (even from a lazy chunk) into the one global stylesheet
// every reader downloads. The editor's styles must reach the page only as the inplace.pcss string,
// injected while editing. This walks the editor's own import graph from the in-place entry and fails on
// any `.css` import.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPECIFIER = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null; // a package: not the editor's own code
  const stem = base.replace(/\.js$/, '');
  for (const candidate of [base, `${stem}.ts`, `${stem}.tsx`, join(stem, 'index.ts'), join(stem, 'index.tsx')]) {
    if (existsSync(candidate) && !candidate.endsWith('.js')) return candidate;
  }
  return base;
}

function importGraph(entry: string): { files: Set<string>; cssImports: string[] } {
  const files = new Set<string>();
  const cssImports: string[] = [];
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    if (!/\.(ts|tsx)$/.test(file)) return;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(SPECIFIER)) {
      const spec = m[1] ?? m[2] ?? m[3]!;
      if (/\.css$/i.test(spec)) cssImports.push(`${file.slice(SRC.length + 1)} -> ${spec}`);
      const next = resolveLocal(file, spec);
      if (next) visit(next);
    }
  };
  visit(entry);
  return { files, cssImports };
}

describe('in-place editor stylesheet isolation', () => {
  it('imports no .css file anywhere in its graph', () => {
    const { files, cssImports } = importGraph(join(SRC, 'inplace', 'index.ts'));
    expect(files.size).toBeGreaterThan(50); // the walk really reached Plate kits, nodes and UI files
    expect([...files].some((f) => f.endsWith(join('theme-inpage', 'inplace.pcss')))).toBe(true);
    expect(cssImports).toEqual([]);
  });
});
