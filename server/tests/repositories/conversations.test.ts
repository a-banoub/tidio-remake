import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';

describe('ConversationsRepo', () => {
  it('create + findById + setStatus + closed_at on close', () => {
    const db = makeTestDb('c1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new ConversationsRepo(db);
    repo.create({ id: 'c_1', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    expect(repo.findById('c_1')?.status).toBe('live');
    repo.setStatus('c_1', 'closed', 2000);
    const c = repo.findById('c_1');
    expect(c?.status).toBe('closed');
    expect(c?.closed_at).toBe(2000);
  });
  it('findOpenForVisitor returns most recent open', () => {
    const db = makeTestDb('c2');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new ConversationsRepo(db);
    repo.create({ id: 'c_old', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    repo.create({ id: 'c_new', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 5000, initiated_by: 'visitor' });
    repo.bumpLastMessageAt('c_new', 5000);
    expect(repo.findOpenForVisitor('v_a', 0)?.id).toBe('c_new');
  });
});
