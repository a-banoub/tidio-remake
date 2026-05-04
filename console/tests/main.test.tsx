import { describe, it, expect, beforeEach } from 'vitest';
import { applyPingUrlParam } from '../src/main.js';
import { pendingPing } from '../src/state/store.js';

beforeEach(() => {
  pendingPing.value = null;
  history.replaceState(null, '', '/console/');
});

describe('applyPingUrlParam', () => {
  it('reads ?ping=<visitorId> and sets pendingPing', () => {
    history.replaceState(null, '', '/console/?ping=v_abcdef123456');
    applyPingUrlParam();
    expect(pendingPing.value).toBe('v_abcdef123456');
  });

  it('strips the ping param from the URL after reading', () => {
    history.replaceState(null, '', '/console/?ping=v_abcdef123456&other=keep');
    applyPingUrlParam();
    expect(window.location.search).not.toContain('ping=');
    expect(window.location.search).toContain('other=keep');
  });

  it('is a no-op when no ping param is present', () => {
    history.replaceState(null, '', '/console/');
    applyPingUrlParam();
    expect(pendingPing.value).toBeNull();
  });

  it('rejects malformed visitorIds', () => {
    history.replaceState(null, '', '/console/?ping=not-a-real-id');
    applyPingUrlParam();
    expect(pendingPing.value).toBeNull();
  });
});
