import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';
import { MessagesRepo } from '../../src/repositories/messages.js';

describe('MessagesRepo', () => {
  it('insert + list + markSeen', () => {
    const db = makeTestDb('m1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new ConversationsRepo(db).create({ id: 'c_1', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
    const repo = new MessagesRepo(db);
    const m1 = repo.insert({ conversation_id: 'c_1', sender: 'visitor', body: 'hi', sent_at: 1000 });
    repo.insert({ conversation_id: 'c_1', sender: 'operator', body: 'hello', sent_at: 1500 });
    expect(repo.listByConversation('c_1')).toHaveLength(2);
    repo.markSeen(m1.id, 2000);
    expect(repo.findById(m1.id)?.seen_at).toBe(2000);
  });
});
