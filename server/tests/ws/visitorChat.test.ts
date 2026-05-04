import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('vc-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  // seed an operator with status=online so conversation goes to 'live'
  new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

async function helloAndWait(ws: WebSocket, vid: string, sid: string) {
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({ type: 'hello', visitorId: vid, sessionId: sid, page: { url: 'https://simple1031x.com/x', title: 'X' }, utms: {}, referrer: null, userAgent: 'M' }));
  await new Promise(r => ws.once('message', () => r(null)));
}

describe('visitor chat lifecycle', () => {
  it('chat_open + chat_message creates conversation + message rows', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await helloAndWait(ws, vid, sid);
    ws.send(JSON.stringify({ type: 'chat_open' }));
    ws.send(JSON.stringify({ type: 'chat_message', body: 'Is $799 the all-in?' }));
    await new Promise(r => setTimeout(r, 50));
    const conv = db.prepare('SELECT * FROM conversations WHERE visitor_id = ?').get(vid) as any;
    expect(conv).toBeDefined();
    expect(conv.status).toBe('live'); // operator is online
    const msgs = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').all(conv.id);
    expect(msgs).toHaveLength(1);
    expect((msgs[0] as any).body).toBe('Is $799 the all-in?');
    ws.close();
  });
});
