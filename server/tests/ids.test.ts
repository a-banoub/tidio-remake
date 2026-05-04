import { describe, it, expect } from 'vitest';
import { newVisitorId, newSessionId, newConversationId, newToken } from '../src/ids.js';

describe('id generators', () => {
  it('newVisitorId starts with v_ and is unique', () => {
    const a = newVisitorId(), b = newVisitorId();
    expect(a).toMatch(/^v_[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
  it('newSessionId starts with s_', () => {
    expect(newSessionId()).toMatch(/^s_[0-9a-f]{12}$/);
  });
  it('newConversationId starts with c_', () => {
    expect(newConversationId()).toMatch(/^c_[0-9a-f]{16}$/);
  });
  it('newToken returns 64 hex chars', () => {
    expect(newToken()).toMatch(/^[0-9a-f]{64}$/);
  });
});
