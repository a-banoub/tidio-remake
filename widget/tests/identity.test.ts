import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateVisitorId, newSessionId } from '../src/identity.js';

describe('identity', () => {
  beforeEach(() => { localStorage.clear(); });

  it('creates and persists visitorId', () => {
    const id = getOrCreateVisitorId();
    expect(id).toMatch(/^v_[0-9a-f]{12}$/);
    expect(getOrCreateVisitorId()).toBe(id);
  });

  it('newSessionId is unique per call', () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });
});
