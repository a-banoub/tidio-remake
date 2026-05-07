import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';

describe('ConversationsRepo.reconcileStaleAsAbandoned', () => {
  it('marks stale live conversations as abandoned and returns row count', () => {
    const db = makeTestDb('reconcile1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new VisitorsRepo(db).upsert('v_b', 1000);
    const repo = new ConversationsRepo(db);
    const now = 10_000_000;
    const oneHourMs = 3_600_000;

    // Stale: last_message_at is 2 hours ago
    repo.create({ id: 'c_stale', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: now - oneHourMs * 2, initiated_by: 'visitor' });
    // Fresh: last_message_at is 30 min ago (within threshold)
    repo.create({ id: 'c_fresh', visitor_id: 'v_b', opened_session_id: null, status: 'live', opened_at: now - oneHourMs / 2, initiated_by: 'visitor' });
    // Bump last_message_at to simulate activity
    repo.bumpLastMessageAt('c_stale', now - oneHourMs * 2);
    repo.bumpLastMessageAt('c_fresh', now - oneHourMs / 2);

    const count = repo.reconcileStaleAsAbandoned(oneHourMs, now);
    expect(count).toBe(1);

    const stale = repo.findById('c_stale');
    expect(stale?.status).toBe('abandoned');
    expect(stale?.closed_at).toBe(now - oneHourMs * 2);

    const fresh = repo.findById('c_fresh');
    expect(fresh?.status).toBe('live');
    expect(fresh?.closed_at).toBeNull();
  });

  it('is idempotent — already-abandoned rows are not touched again', () => {
    const db = makeTestDb('reconcile2');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new ConversationsRepo(db);
    const now = 10_000_000;
    const oneHourMs = 3_600_000;

    repo.create({ id: 'c_stale', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: now - oneHourMs * 2, initiated_by: 'visitor' });
    repo.bumpLastMessageAt('c_stale', now - oneHourMs * 2);

    expect(repo.reconcileStaleAsAbandoned(oneHourMs, now)).toBe(1);
    // Second run: already abandoned, closed_at is set → should not match WHERE clause
    expect(repo.reconcileStaleAsAbandoned(oneHourMs, now)).toBe(0);
  });

  it('returns 0 when no stale conversations exist', () => {
    const db = makeTestDb('reconcile3');
    const repo = new ConversationsRepo(db);
    expect(repo.reconcileStaleAsAbandoned(3_600_000, Date.now())).toBe(0);
  });

  it('does not touch queued conversations even if old', () => {
    const db = makeTestDb('reconcile4');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new ConversationsRepo(db);
    const now = 10_000_000;
    const oneHourMs = 3_600_000;

    repo.create({ id: 'c_queued', visitor_id: 'v_a', opened_session_id: null, status: 'queued', opened_at: now - oneHourMs * 2, initiated_by: 'visitor' });
    repo.bumpLastMessageAt('c_queued', now - oneHourMs * 2);

    expect(repo.reconcileStaleAsAbandoned(oneHourMs, now)).toBe(0);
    expect(repo.findById('c_queued')?.status).toBe('queued');
  });
});

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
