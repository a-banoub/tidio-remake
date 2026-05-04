import { describe, it, expect } from 'vitest';
import { signVisitorCookie, verifyVisitorCookie } from '../../src/auth/visitorCookie.js';

const SECRET = 'a'.repeat(64);

describe('visitor cookie', () => {
  it('signs then verifies', () => {
    const t = signVisitorCookie('v_abc', 's_123', SECRET);
    expect(verifyVisitorCookie(t, SECRET)).toMatchObject({ visitorId: 'v_abc', sessionId: 's_123' });
  });
  it('rejects tampered token', () => {
    const t = signVisitorCookie('v_abc', 's_123', SECRET);
    expect(verifyVisitorCookie(t.slice(0, -2) + 'XX', SECRET)).toBeNull();
  });
  it('rejects wrong secret', () => {
    const t = signVisitorCookie('v_abc', 's_123', SECRET);
    expect(verifyVisitorCookie(t, 'b'.repeat(64))).toBeNull();
  });
});
