import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';

let server: any, port: number, db: any, ls: LiveSessions, validToken: string;

beforeEach(async () => {
  db = makeTestDb('opsub-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  validToken = 's'.repeat(64);
  new OperatorTokensRepo(db).create(validToken, opId, 1000);
  // Seed a queued conversation
  new VisitorsRepo(db).upsert('v_aaaaaaaaaaaa', 1000);
  new ConversationsRepo(db).create({
    id: 'c_aaaaaaaaaaaaaaaa', visitor_id: 'v_aaaaaaaaaaaa',
    opened_session_id: null, status: 'queued',
    opened_at: 1000, initiated_by: 'visitor',
  });
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

describe('operator subscribe', () => {
  it('responds with state_snapshot containing the queued conversation', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`, { headers: { authorization: `Bearer ${validToken}` } });
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({ type: 'subscribe' }));
    const snapshot: any = await new Promise(r => ws.on('message', m => r(JSON.parse(m.toString()))));
    expect(snapshot.type).toBe('state_snapshot');
    expect(snapshot.queuedConversations).toHaveLength(1);
    expect(snapshot.queuedConversations[0].id).toBe('c_aaaaaaaaaaaaaaaa');
    expect(snapshot.openConversations).toHaveLength(0);
    expect(snapshot.liveVisitors).toEqual([]);
    expect(Array.isArray(snapshot.recentlyClosedConversations)).toBe(true);
    ws.close();
  });

  it('rejects unknown message types with error', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`, { headers: { authorization: `Bearer ${validToken}` } });
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({ type: 'garbage' }));
    const reply: any = await new Promise(r => ws.on('message', m => r(JSON.parse(m.toString()))));
    expect(reply.type).toBe('error');
    expect(reply.code).toBe('bad_message');
    ws.close();
  });
});
