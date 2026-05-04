import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';
import { PushSubscriptionsRepo } from '../../src/repositories/pushSubscriptions.js';
import { QuickRepliesRepo } from '../../src/repositories/quickReplies.js';

describe('operator-related repos', () => {
  it('roundtrip across all four', () => {
    const db = makeTestDb('opr');
    const ops = new OperatorsRepo(db);
    const id = ops.create({ email: 'a@b.com', password_hash: 'h', display_name: 'Alex', created_at: 1000 });
    expect(ops.findByEmail('a@b.com')?.id).toBe(id);
    ops.setStatus(id, 'away');
    expect(ops.findById(id)?.status).toBe('away');
    ops.setQuietHours(id, '21:00', '08:00');
    expect(ops.findById(id)?.quiet_hours_start).toBe('21:00');

    const tokens = new OperatorTokensRepo(db);
    tokens.create('tok1', id, 1000);
    expect(tokens.findOperatorIdByToken('tok1', 2000)).toBe(id);
    tokens.revoke('tok1');
    expect(tokens.findOperatorIdByToken('tok1', 3000)).toBeUndefined();

    const push = new PushSubscriptionsRepo(db);
    push.upsert({ operator_id: id, endpoint: 'https://e1', p256dh: 'p', auth: 'a', device_label: 'PC', created_at: 1000 });
    expect(push.listForOperator(id)).toHaveLength(1);
    push.deleteByEndpoint('https://e1');
    expect(push.listForOperator(id)).toHaveLength(0);

    const qr = new QuickRepliesRepo(db);
    const qid = qr.create(id, 'Send link', 'Here is the link', 0);
    qr.update(qid, { label: 'Send start link' });
    expect(qr.list(id)[0].label).toBe('Send start link');
    qr.remove(qid);
    expect(qr.list(id)).toHaveLength(0);
  });
});
