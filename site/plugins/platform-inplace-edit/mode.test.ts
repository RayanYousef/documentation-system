import { describe, it, expect } from 'vitest';
import { resolveEditMode, devEndpointPath } from './mode.mjs';

describe('resolveEditMode', () => {
  it('saves to disk on the dev server and to GitHub in every production build', () => {
    expect(resolveEditMode({ nodeEnv: 'development' })).toBe('local-disk');
    expect(resolveEditMode({ nodeEnv: 'production' })).toBe('github');
    expect(resolveEditMode({})).toBe('github');
  });

  it('PLATFORM_EDIT_BACKEND=github forces GitHub on the dev server', () => {
    expect(resolveEditMode({ nodeEnv: 'development', forceBackend: 'github' })).toBe('github');
  });

  it('never turns a production build into a disk-writing one', () => {
    expect(resolveEditMode({ nodeEnv: 'production', forceBackend: 'local-disk' })).toBe('github');
    expect(resolveEditMode({ nodeEnv: 'development', forceBackend: 'local-disk' })).toBe('local-disk');
  });
});

describe('devEndpointPath', () => {
  it('lives under the site baseUrl', () => {
    expect(devEndpointPath('/documentation-system/')).toBe('/documentation-system/__platform/content');
    expect(devEndpointPath('/')).toBe('/__platform/content');
    expect(devEndpointPath('/docs')).toBe('/docs/__platform/content');
  });
});
