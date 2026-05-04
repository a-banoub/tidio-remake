import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

const PEPPER = 'p'.repeat(64);

describe('password', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('secret', PEPPER);
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('secret', h, PEPPER)).toBe(true);
  });
  it('rejects wrong password', async () => {
    const h = await hashPassword('secret', PEPPER);
    expect(await verifyPassword('nope', h, PEPPER)).toBe(false);
  });
  it('rejects when pepper changes', async () => {
    const h = await hashPassword('secret', PEPPER);
    expect(await verifyPassword('secret', h, 'q'.repeat(64))).toBe(false);
  });
});
