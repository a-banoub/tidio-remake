import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';
import { PushSubscriptionsRepo } from '../../src/repositories/pushSubscriptions.js';

let server: any, port: number, db: any, ls: LiveSessions, token: string, opId: number;

beforeEach(async () => {
  db = makeTestDb('push-api-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  token = 'x'.repeat(64);
  new OperatorTokensRepo(db).create(token, opId, 1000);
  server = createServer({
    db,
    ls,
    env: {
      VAPID_PUBLIC_KEY: 'TEST_PUBLIC_KEY',
      VAPID_PRIVATE_KEY: 'TEST_PRIVATE_KEY',
      VAPID_SUBJECT: 'mailto:test@example.com',
    } as any,
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

function call(opts: { method: string; path: string; body?: any; auth?: string }): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = opts.body == null ? null : JSON.stringify(opts.body);
    const headers: any = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (opts.auth) headers['Authorization'] = `Bearer ${opts.auth}`;
    const r = request({ host: '127.0.0.1', port, path: opts.path, method: opts.method, headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('GET /api/operator/push-public-key', () => {
  it('returns the configured VAPID public key without auth', async () => {
    const res = await call({ method: 'GET', path: '/api/operator/push-public-key' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ key: 'TEST_PUBLIC_KEY' });
  });
});

describe('POST /api/operator/push-subscribe', () => {
  it('rejects without auth', async () => {
    const res = await call({
      method: 'POST',
      path: '/api/operator/push-subscribe',
      body: { endpoint: 'https://e', keys: { p256dh: 'p', auth: 'a' } },
    });
    expect(res.status).toBe(401);
  });

  it('inserts a subscription with auth', async () => {
    const res = await call({
      method: 'POST',
      path: '/api/operator/push-subscribe',
      auth: token,
      body: { endpoint: 'https://e1', keys: { p256dh: 'p1', auth: 'a1' }, deviceLabel: 'PC' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const subs = new PushSubscriptionsRepo(db).listForOperator(opId);
    expect(subs).toHaveLength(1);
    expect(subs[0].endpoint).toBe('https://e1');
    expect(subs[0].p256dh).toBe('p1');
    expect(subs[0].device_label).toBe('PC');
  });

  it('updates p256dh on duplicate endpoint', async () => {
    await call({
      method: 'POST', path: '/api/operator/push-subscribe', auth: token,
      body: { endpoint: 'https://dup', keys: { p256dh: 'old', auth: 'a' } },
    });
    const res = await call({
      method: 'POST', path: '/api/operator/push-subscribe', auth: token,
      body: { endpoint: 'https://dup', keys: { p256dh: 'new', auth: 'a' } },
    });
    expect(res.status).toBe(200);
    const subs = new PushSubscriptionsRepo(db).listForOperator(opId);
    expect(subs).toHaveLength(1);
    expect(subs[0].p256dh).toBe('new');
  });

  it('rejects malformed body with 400', async () => {
    const res = await call({
      method: 'POST', path: '/api/operator/push-subscribe', auth: token,
      body: { endpoint: 'https://e', keys: { p256dh: 'p' } }, // missing auth
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/operator/push-subscribe', () => {
  it('removes the row', async () => {
    await call({
      method: 'POST', path: '/api/operator/push-subscribe', auth: token,
      body: { endpoint: 'https://gone', keys: { p256dh: 'p', auth: 'a' } },
    });
    const res = await call({
      method: 'DELETE', path: '/api/operator/push-subscribe', auth: token,
      body: { endpoint: 'https://gone' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(new PushSubscriptionsRepo(db).listForOperator(opId)).toHaveLength(0);
  });

  it('rejects without auth', async () => {
    const res = await call({
      method: 'DELETE', path: '/api/operator/push-subscribe',
      body: { endpoint: 'https://x' },
    });
    expect(res.status).toBe(401);
  });
});
