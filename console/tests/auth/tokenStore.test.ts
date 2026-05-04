import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStore } from '../../src/auth/tokenStore.js';

describe('tokenStore', () => {
  beforeEach(() => localStorage.clear());

  it('set/get/clear roundtrip', () => {
    expect(tokenStore.get()).toBeNull();
    tokenStore.set('abc');
    expect(tokenStore.get()).toBe('abc');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});
