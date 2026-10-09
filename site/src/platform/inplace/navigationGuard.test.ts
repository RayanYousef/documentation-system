import { describe, it, expect, vi, afterEach } from 'vitest';
import { createNavigationGuard } from './navigationGuard';

type Prompt = (location: { pathname: string }, action: string) => string | false | void;

function fakeHistory(pathname: string) {
  const unblock = vi.fn();
  const history = { location: { pathname }, block: vi.fn((_p: Prompt) => unblock) };
  const prompt = () => history.block.mock.calls[0]![0];
  return { history, unblock, prompt };
}

describe('createNavigationGuard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks before leaving the page; "yes" lets the navigation through and reports the leave', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
    const { history, prompt } = fakeHistory('/b/systems/inventory');
    const onLeave = vi.fn();
    createNavigationGuard(history).block('Discard them?', onLeave);
    expect(prompt()({ pathname: '/b/systems/combat' }, 'PUSH')).not.toBe(false);
    expect(confirm).toHaveBeenCalledWith('Discard them?');
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('"no" blocks the navigation and keeps the edits', () => {
    vi.stubGlobal('window', { confirm: vi.fn(() => false) });
    const { history, prompt } = fakeHistory('/b/systems/inventory');
    const onLeave = vi.fn();
    createNavigationGuard(history).block('Discard them?', onLeave);
    expect(prompt()({ pathname: '/b/systems/combat' }, 'PUSH')).toBe(false);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('does not ask for a jump within the page (table of contents, heading anchors)', () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });
    const { history, prompt } = fakeHistory('/b/systems/inventory');
    createNavigationGuard(history).block('Discard them?');
    expect(prompt()({ pathname: '/b/systems/inventory' }, 'PUSH')).not.toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('returns the router unblock function', () => {
    const { history, unblock } = fakeHistory('/b/x');
    expect(createNavigationGuard(history).block('m')).toBe(unblock);
  });
});
