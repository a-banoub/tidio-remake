import { describe, it, expect, beforeEach } from 'vitest';
import { loadEnv } from '../src/env.js';

describe('loadEnv', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    process.env.VISITOR_COOKIE_SECRET = 'a'.repeat(64);
    process.env.OPERATOR_PASSWORD_PEPPER = 'b'.repeat(64);
    process.env.DATABASE_PATH = '/tmp/test.db';
  });

  it('parses required env vars', () => {
    const env = loadEnv();
    expect(env.VAPID_SUBJECT).toBe('mailto:test@example.com');
  });

  it('throws on missing var', () => {
    delete process.env.VAPID_PUBLIC_KEY;
    expect(() => loadEnv()).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it('rejects too-short secret', () => {
    process.env.VISITOR_COOKIE_SECRET = 'short';
    expect(() => loadEnv()).toThrow(/VISITOR_COOKIE_SECRET/);
  });
});
