import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';

describe('VisitorsRepo', () => {
  it('upsert + findById', () => {
    const db = makeTestDb('v1');
    const repo = new VisitorsRepo(db);
    repo.upsert('v_a', 1000);
    expect(repo.findById('v_a')).toMatchObject({ first_seen_at: 1000, last_seen_at: 1000 });
    repo.upsert('v_a', 2000);
    expect(repo.findById('v_a')).toMatchObject({ first_seen_at: 1000, last_seen_at: 2000 });
  });
  it('updateContact patches', () => {
    const db = makeTestDb('v2');
    const repo = new VisitorsRepo(db);
    repo.upsert('v_a', 1000);
    repo.updateContact('v_a', { name: 'Mike', email: 'm@e.com' });
    expect(repo.findById('v_a')).toMatchObject({ name: 'Mike', email: 'm@e.com', phone: null });
  });
});
