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

  it('listRecentlyClosed returns closed/abandoned/closed_for_followup ordered by closed_at DESC', () => {
    const db = makeTestDb('c3');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new VisitorsRepo(db).upsert('v_b', 1000);
    const repo = new ConversationsRepo(db);
    repo.create({ id: 'c_closed', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    repo.setStatus('c_closed', 'closed', 3000);
    repo.create({ id: 'c_abandoned', visitor_id: 'v_b', opened_session_id: null, status: 'live', opened_at: 2000, initiated_by: 'visitor' });
    repo.setStatus('c_abandoned', 'abandoned', 2000);
    repo.create({ id: 'c_old', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 500, initiated_by: 'visitor' });
    repo.setStatus('c_old', 'closed', 500);

    const result = repo.listRecentlyClosed(0, 10);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('c_closed');
    expect(result[1].id).toBe('c_abandoned');
    expect(result[2].id).toBe('c_old');

    const filtered = repo.listRecentlyClosed(2500, 10);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('c_closed');
  });
});
