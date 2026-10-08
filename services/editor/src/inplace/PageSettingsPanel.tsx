// "Page settings": the frontmatter form (description, type, tags, resource, sidebar_position) in a panel
// above the page. The types already in use are listed once, the first time the panel opens.
import { useEffect, useState } from 'react';
import { CURRENT_VERSION, type ContentBackend } from '@platform/contracts';
import { FrontmatterForm } from '../components/FrontmatterForm.js';
import type { FrontmatterFields } from '../frontmatter/yamlDoc.js';

let typesCache: { backend: ContentBackend; types: Promise<string[]> } | null = null;

function typesInUse(backend: ContentBackend): Promise<string[]> {
  if (typesCache?.backend !== backend) {
    const types = backend.listPages(CURRENT_VERSION).then((ps) => [...new Set(ps.map((p) => p.type).filter(Boolean))].sort(), () => []);
    typesCache = { backend, types };
  }
  return typesCache.types;
}

export function PageSettingsPanel({ backend, fields, readOnly, onChange }: { backend: ContentBackend; fields: FrontmatterFields; readOnly: boolean; onChange(next: FrontmatterFields): void }) {
  const [types, setTypes] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void typesInUse(backend).then((t) => { if (alive) setTypes(t); });
    return () => { alive = false; };
  }, [backend]);
  return (
    <section className="ped-settings ped-chrome" aria-label="Page settings">
      <h3>Page settings</h3>
      <FrontmatterForm fields={fields} typesInUse={types} disabled={readOnly} onChange={onChange} />
    </section>
  );
}
