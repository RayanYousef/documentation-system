import { describe, it, expect } from 'vitest';
import { fieldsFor, parsePropInput } from './PropFields.js';

describe('parsePropInput', () => {
  it('removes an emptied string prop and keeps any other text', () => {
    expect(parsePropInput('string', '')).toBeUndefined();
    expect(parsePropInput('string', ' a b ')).toBe(' a b ');
  });

  it('stores numbers as numbers, removes an empty one and ignores anything else', () => {
    expect(parsePropInput('number', '400')).toBe(400);
    expect(parsePropInput('number', ' ')).toBeUndefined();
    expect(parsePropInput('number', 'abc')).toBeNull();
  });
});

describe('fieldsFor', () => {
  it('uses the manifest props when there is an entry', () => {
    const props = [{ name: 'src', type: 'string' as const }];
    expect(fieldsFor({ name: 'X', kind: 'flow', hasChildren: false, preview: 'generic', props }, { type: 'jsx_void', children: [] })).toBe(props);
  });

  it('falls back to the props the node was read with', () => {
    const node = { type: 'model_viewer', attrOrder: ['src', '#extra0', 'height', 'ref', 'autoRotate'], src: '/a', height: 3, gitRef: 'main', autoRotate: true, children: [] };
    expect(fieldsFor(undefined, node)).toEqual([
      { name: 'src', type: 'string' }, { name: 'height', type: 'number' }, { name: 'ref', type: 'string' }, { name: 'autoRotate', type: 'boolean' },
    ]);
  });
});
