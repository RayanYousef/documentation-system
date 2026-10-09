// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';
import type { AuthProvider } from '@platform/contracts';
import { NewPageDialog } from './NewPageDialog.js';
import { PublishDialog } from './PublishDialog.js';
import { SignInDialog } from '../inplace/SignInDialog.js';
import { Modal } from './Modal.js';
import type { InPlaceHost } from '../host.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
async function mount(el: ReactElement): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(el));
  return host;
}
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); document.body.innerHTML = ''; });

/** Drives a React controlled input the way a user would (native setter + input event). */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
const byLabel = (host: HTMLElement, label: string) => host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === text)!;
const click = (b: HTMLButtonElement) => act(async () => { b.click(); });
const tick = () => act(async () => { await Promise.resolve(); });

describe('NewPageDialog', () => {
  it('shows the backend error inside the dialog, stays open and re-enables Create', async () => {
    const onCreate = vi.fn(async () => { throw new Error('Invalid page path: bad path.md'); });
    const host = await mount(<NewPageDialog typesInUse={['system']} defaultResource="" onCreate={onCreate} onClose={() => {}} />);
    await type(byLabel(host, 'New page path'), 'bad path.md');
    await type(byLabel(host, 'New page title'), 'T');
    await type(byLabel(host, 'New page description'), 'D');
    await click(button(host, 'Create'));
    await tick();
    expect(onCreate).toHaveBeenCalledWith('bad path.md', expect.stringContaining('title: T'));
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Invalid page path: bad path.md');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button(host, 'Create').disabled).toBe(false);
  });
  it('offers Blank (the default) or Feature page; Feature page starts with three tabs', async () => {
    const onCreate = vi.fn(async () => {});
    const host = await mount(<NewPageDialog typesInUse={['guide']} defaultResource="" onCreate={onCreate} onClose={() => {}} />);
    const radios = [...host.querySelectorAll<HTMLInputElement>('fieldset input[type="radio"]')];
    expect(radios.map((r) => r.parentElement!.textContent!.trim())).toEqual(['Blank', 'Feature page']);
    expect(radios[0]!.checked).toBe(true);
    await act(async () => { radios[1]!.click(); });
    await type(byLabel(host, 'New page path'), 'systems/crafting.md');
    await type(byLabel(host, 'New page title'), 'Crafting');
    await type(byLabel(host, 'New page description'), 'How crafting works.');
    await click(button(host, 'Create'));
    await tick();
    const text = (onCreate.mock.calls[0] as unknown as [string, string])[1];
    expect(text).toMatch(/^---\n[\s\S]*title: Crafting[\s\S]*---\n\n# Crafting\n\n<Tabs>\n {2}<TabItem value="how-to-use" label="How to use" default>/);
    expect(text).toContain('<TabItem value="api" label="API">');
    expect(text).toContain('<TabItem value="misc" label="Misc">');
  });
  it('labels the dialog by its heading', async () => {
    const host = await mount(<NewPageDialog typesInUse={[]} defaultResource="" onCreate={async () => {}} onClose={() => {}} />);
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('New page');
  });
});

describe('PublishDialog', () => {
  it('shows the backend error inside the dialog', async () => {
    const onPublish = vi.fn(async () => { throw new Error('GitHub API 502 for /git/refs'); });
    const host = await mount(<PublishDialog existing={['current', '1.0.0']} onPublish={onPublish} onClose={() => {}} />);
    await type(byLabel(host, 'Version'), '1.1.0');
    await click(button(host, 'Publish'));
    await tick();
    expect(onPublish).toHaveBeenCalledWith('1.1.0');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('GitHub API 502 for /git/refs');
    expect(button(host, 'Publish').disabled).toBe(false);
  });
  it('refuses an existing or malformed version label', async () => {
    const host = await mount(<PublishDialog existing={['current', '1.0.0']} onPublish={async () => {}} onClose={() => {}} />);
    await type(byLabel(host, 'Version'), '1.0.0');
    expect(button(host, 'Publish').disabled).toBe(true);
    expect(host.textContent).toContain('Version 1.0.0 already exists.');
    await type(byLabel(host, 'Version'), 'v2');
    expect(button(host, 'Publish').disabled).toBe(true);
  });
});

describe('SignInDialog', () => {
  const host = (auth: AuthProvider): Pick<InPlaceHost, 'auth' | 'config' | 'mode'> => ({ auth, config: { organizationName: 'o', projectName: 'r', deployBranch: 'main' } as InPlaceHost['config'], mode: 'github' });
  const unused = async () => { throw new Error('unused'); };
  it('announces why a saved session was forgotten', async () => {
    const auth: AuthProvider = { id: 'github-token', login: unused, verify: unused };
    const el = await mount(<SignInDialog host={host(auth)} initialError="Your saved session is no longer valid and was forgotten. You are not a write collaborator of o/r." onSignedIn={() => {}} onCancel={() => {}} />);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('not a write collaborator of o/r');
    expect(el.textContent).toContain('Only write collaborators can sign in.');
  });
  it('shows the provider error for a rejected token', async () => {
    const auth: AuthProvider = { id: 'github-token', login: async () => { throw new Error('You are not a write collaborator of o/r. Ask a repository admin for write access.'); }, verify: unused };
    const el = await mount(<SignInDialog host={host(auth)} onSignedIn={() => {}} onCancel={() => {}} />);
    await type(byLabel(el, 'GitHub token'), 'github_pat_x');
    await click(button(el, 'Sign in'));
    await tick();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('not a write collaborator');
  });
  it('remembers by default, warns about it, and hands back session, identity and the choice', async () => {
    const session = { provider: 'github-token', token: 't', createdAt: '' };
    const identity = { name: 'Ray', login: 'ray', email: null, role: 'editor' as const };
    const auth: AuthProvider = { id: 'github-token', login: vi.fn(async () => session), verify: vi.fn(async () => identity) };
    const onSignedIn = vi.fn();
    const el = await mount(<SignInDialog host={host(auth)} onSignedIn={onSignedIn} onCancel={() => {}} />);
    expect(el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(el.textContent).toContain('Anyone using this browser profile can read the saved token');
    await type(byLabel(el, 'GitHub token'), '  github_pat_x  ');
    await click(button(el, 'Sign in'));
    await tick();
    expect(auth.login).toHaveBeenCalledWith({ kind: 'github-token', token: 'github_pat_x' });
    expect(onSignedIn).toHaveBeenCalledWith(session, identity, true);
  });
  it('asks the mock provider for a display name', async () => {
    const auth: AuthProvider = { id: 'mock', login: unused, verify: unused };
    const el = await mount(<SignInDialog host={{ ...host(auth), mode: 'local-disk' }} onSignedIn={() => {}} onCancel={() => {}} />);
    expect(byLabel(el, 'Display name')).not.toBeNull();
    expect(el.textContent).toContain('working tree');
  });
  it('explains an unknown provider instead of showing an empty form', async () => {
    const auth: AuthProvider = { id: 'saml', login: unused, verify: unused };
    const el = await mount(<SignInDialog host={host(auth)} onSignedIn={() => {}} onCancel={() => {}} />);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('"saml"');
  });
});

describe('Modal', () => {
  it('closes on Escape when a close handler is given', async () => {
    const onClose = vi.fn();
    await mount(<Modal title="X" onClose={onClose}><p>body</p></Modal>);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
