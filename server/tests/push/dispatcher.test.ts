import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import webpush from 'web-push';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { PushSubscriptionsRepo } from '../../src/repositories/pushSubscriptions.js';
import { pushToOperator, _resetVapidForTests } from '../../src/push/dispatcher.js';

let env: any;

beforeAll(() => {
  // Generate real VAPID keys so setVapidDetails accepts them.
  const k = webpush.generateVAPIDKeys();
  env = {
    VAPID_PUBLIC_KEY: k.publicKey,
    VAPID_PRIVATE_KEY: k.privateKey,
    VAPID_SUBJECT: 'mailto:test@example.com',
  };
});

beforeEach(() => {
  _resetVapidForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeDeps(db: any) {
  return { db, env, ls: null as any, timers: null as any, oc: null as any };
}

describe('pushToOperator', () => {
  it('cleans up subscription when send returns 410 Gone', async () => {
    const db = makeTestDb('push-disp-410-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://expired.example/e', p256dh: 'p', auth: 'a', created_at: 1 });
    expect(repo.listForOperator(opId)).toHaveLength(1);

    const err: any = new Error('Gone');
    err.statusCode = 410;
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(err);

    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b' });
    expect(repo.listForOperator(opId)).toHaveLength(0);
  });

  it('cleans up subscription when send returns 404', async () => {
    const db = makeTestDb('push-disp-404-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://nf.example/e', p256dh: 'p', auth: 'a', created_at: 1 });

    const err: any = new Error('Not found');
    err.statusCode = 404;
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(err);

    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b' });
    expect(repo.listForOperator(opId)).toHaveLength(0);
  });

  it('keeps subscription on transient errors (e.g. 500)', async () => {
    const db = makeTestDb('push-disp-500-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://flaky.example/e', p256dh: 'p', auth: 'a', created_at: 1 });

    const err: any = new Error('Server error');
    err.statusCode = 500;
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(err);

    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b' });
    expect(repo.listForOperator(opId)).toHaveLength(1);
  });

  it('bumps last_used_at on successful send', async () => {
    const db = makeTestDb('push-disp-ok-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://ok.example/e', p256dh: 'p', auth: 'a', created_at: 1 });

    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} } as any);

    const before = Date.now();
    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b', url: '/x' });
    const subs = repo.listForOperator(opId);
    expect(subs).toHaveLength(1);
    expect(subs[0].last_used_at).not.toBeNull();
    expect(subs[0].last_used_at!).toBeGreaterThanOrEqual(before);
  });

  it('sends correct payload to subscription endpoint', async () => {
    const db = makeTestDb('push-disp-payload-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://target.example/e', p256dh: 'PP', auth: 'AA', created_at: 1 });

    const spy = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} } as any);

    await pushToOperator(makeDeps(db), opId, { title: 'Hi', body: 'world', url: '/console/' });

    expect(spy).toHaveBeenCalledTimes(1);
    const [sub, payload] = spy.mock.calls[0];
    expect(sub).toEqual({ endpoint: 'https://target.example/e', keys: { p256dh: 'PP', auth: 'AA' } });
    expect(JSON.parse(payload as string)).toEqual({ title: 'Hi', body: 'world', url: '/console/' });
  });

  it('passes urgency in options arg to sendNotification', async () => {
    const db = makeTestDb('push-disp-urgency-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://urgency.example/e', p256dh: 'p', auth: 'a', created_at: 1 });

    const spy = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} } as any);

    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b', urgency: 'high' });

    expect(spy).toHaveBeenCalledTimes(1);
    const [, , opts] = spy.mock.calls[0];
    expect((opts as any).urgency).toBe('high');
  });

  it('includes tag in serialized payload and omits urgency from options when not set', async () => {
    const db = makeTestDb('push-disp-tag-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://tag.example/e', p256dh: 'p', auth: 'a', created_at: 1 });

    const spy = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} } as any);

    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b', tag: 'visitor-abc123' });

    expect(spy).toHaveBeenCalledTimes(1);
    const [, rawPayload, opts] = spy.mock.calls[0];
    const parsed = JSON.parse(rawPayload as string);
    expect(parsed.tag).toBe('visitor-abc123');
    expect((opts as any).urgency).toBeUndefined();
  });

  it('iterates over multiple subscriptions independently', async () => {
    const db = makeTestDb('push-disp-multi-' + Math.random().toString(36).slice(2));
    const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
    const repo = new PushSubscriptionsRepo(db);
    repo.upsert({ operator_id: opId, endpoint: 'https://ok.example/e', p256dh: 'p', auth: 'a', created_at: 1 });
    repo.upsert({ operator_id: opId, endpoint: 'https://gone.example/e', p256dh: 'p', auth: 'a', created_at: 1 });

    vi.spyOn(webpush, 'sendNotification').mockImplementation(async (sub: any) => {
      if (sub.endpoint === 'https://gone.example/e') {
        const e: any = new Error('Gone');
        e.statusCode = 410;
        throw e;
      }
      return { statusCode: 201, body: '', headers: {} } as any;
    });

    await pushToOperator(makeDeps(db), opId, { title: 't', body: 'b' });
    const subs = repo.listForOperator(opId);
    expect(subs.map(s => s.endpoint)).toEqual(['https://ok.example/e']);
  });
});
