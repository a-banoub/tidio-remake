import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { PushSubscriptionsRepo } from '../../src/repositories/pushSubscriptions.js';

function setup() {
  const db = makeTestDb('push-' + Math.random().toString(36).slice(2));
  const opId = new OperatorsRepo(db).create({ email: 'op@x', password_hash: 'h', display_name: 'Op', created_at: 1000 });
  const repo = new PushSubscriptionsRepo(db);
  return { db, opId, repo };
}

describe('PushSubscriptionsRepo', () => {
  it('upsert inserts a new subscription', () => {
    const { opId, repo } = setup();
    repo.upsert({ operator_id: opId, endpoint: 'https://example.com/e1', p256dh: 'p1', auth: 'a1', device_label: 'PC', created_at: 1000 });
    const subs = repo.listForOperator(opId);
    expect(subs).toHaveLength(1);
    expect(subs[0].endpoint).toBe('https://example.com/e1');
    expect(subs[0].p256dh).toBe('p1');
    expect(subs[0].auth).toBe('a1');
    expect(subs[0].device_label).toBe('PC');
  });

  it('upsert preserves created_at on conflict but updates keys/label', () => {
    const { opId, repo } = setup();
    repo.upsert({ operator_id: opId, endpoint: 'https://e2', p256dh: 'p1', auth: 'a1', device_label: 'PC', created_at: 1000 });
    repo.upsert({ operator_id: opId, endpoint: 'https://e2', p256dh: 'p2', auth: 'a2', device_label: 'Phone', created_at: 9999 });
    const subs = repo.listForOperator(opId);
    expect(subs).toHaveLength(1);
    expect(subs[0].p256dh).toBe('p2');
    expect(subs[0].auth).toBe('a2');
    expect(subs[0].device_label).toBe('Phone');
    expect(subs[0].created_at).toBe(1000);
  });

  it('listForOperator returns only that operators subscriptions', () => {
    const { db, opId, repo } = setup();
    const op2 = new OperatorsRepo(db).create({ email: 'o2@x', password_hash: 'h', display_name: 'B', created_at: 1000 });
    repo.upsert({ operator_id: opId, endpoint: 'https://a', p256dh: 'p', auth: 'a', created_at: 1 });
    repo.upsert({ operator_id: op2,  endpoint: 'https://b', p256dh: 'p', auth: 'a', created_at: 1 });
    expect(repo.listForOperator(opId)).toHaveLength(1);
    expect(repo.listForOperator(op2)).toHaveLength(1);
    expect(repo.listForOperator(opId)[0].endpoint).toBe('https://a');
  });

  it('bumpLastUsed updates last_used_at', () => {
    const { opId, repo } = setup();
    repo.upsert({ operator_id: opId, endpoint: 'https://e', p256dh: 'p', auth: 'a', created_at: 1 });
    const id = repo.listForOperator(opId)[0].id;
    repo.bumpLastUsed(id, 5000);
    expect(repo.listForOperator(opId)[0].last_used_at).toBe(5000);
  });

  it('deleteByEndpoint removes the row', () => {
    const { opId, repo } = setup();
    repo.upsert({ operator_id: opId, endpoint: 'https://gone', p256dh: 'p', auth: 'a', created_at: 1 });
    repo.deleteByEndpoint('https://gone');
    expect(repo.listForOperator(opId)).toHaveLength(0);
  });
});
