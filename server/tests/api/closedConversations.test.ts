import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { ConversationsRepo } from '../../src/repositories/conversations.js';
import { MessagesRepo } from '../../src/repositories/messages.js';

let server: any, port: number, db: any, ls: LiveSessions, validToken: string;

beforeEach(async () => {
  db = makeTestDb('closedconv-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  validToken = 's'.repeat(64);
  new OperatorTokensRepo(db).create(validToken, opId, 1000);
  new VisitorsRepo(db).upsert('v_a', 1000);
  const convRepo = new ConversationsRepo(db);
  convRepo.create({ id: 'c_closed', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1000, initiated_by: 'visitor' });
  convRepo.setStatus('c_closed', 'closed', 5000);
  new MessagesRepo(db).insert({ conversation_id: 'c_closed', sender: 'visitor', body: 'hello', sent_at: 1000 });
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

function getJson(path: string, token?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('GET /api/operator/conversations/closed', () => {
  it('returns recently closed conversations with messages when authenticated', async () => {
    const res = await getJson('/api/operator/conversations/closed?since=0', validToken);
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].id).toBe('c_closed');
    expect(res.body.conversations[0].lastMessages).toHaveLength(1);
    expect(res.body.conversations[0].lastMessages[0].body).toBe('hello');
  });

  it('returns 401 without token', async () => {
    const res = await getJson('/api/operator/conversations/closed?since=0');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid since', async () => {
    const res = await getJson('/api/operator/conversations/closed?since=bad', validToken);
    expect(res.status).toBe(400);
  });

  it('respects since timestamp', async () => {
    const res = await getJson('/api/operator/conversations/closed?since=6000', validToken);
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(0);
  });
});
