import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

let server: any, port: number, db: any, ls: LiveSessions, validToken: string;

beforeEach(async () => {
  db = makeTestDb('vob-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  validToken = 'b'.repeat(64);
  new OperatorTokensRepo(db).create(validToken, opId, 1000);
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

async function connectOperator(): Promise<{ ws: WebSocket; messages: any[] }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`, { headers: { authorization: `Bearer ${validToken}` } });
  const messages: any[] = [];
  ws.on('message', m => messages.push(JSON.parse(m.toString())));
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({ type: 'subscribe' }));
  await new Promise(r => setTimeout(r, 30));
  return { ws, messages };
}

async function connectVisitor(vid: string, sid: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({
    type: 'hello', visitorId: vid, sessionId: sid,
    page: { url: 'https://simple1031x.com/x', title: 'X' },
    utms: {}, referrer: null, userAgent: 'M',
  }));
  await new Promise(r => ws.once('message', () => r(null)));
  return ws;
}

describe('visitor → operator broadcasts', () => {
  it('hello triggers visitor_appeared on operator', async () => {
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    await new Promise(r => setTimeout(r, 50));
    const appeared = op.messages.find(m => m.type === 'visitor_appeared');
    expect(appeared).toBeDefined();
    expect(appeared.visitor.id).toBe(vid);
    v.close();
    op.ws.close();
  });

  it('chat_message triggers new_message on operator', async () => {
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    v.send(JSON.stringify({ type: 'chat_message', body: 'hello?' }));
    await new Promise(r => setTimeout(r, 50));
    const newMsg = op.messages.find(m => m.type === 'new_message');
    expect(newMsg).toBeDefined();
    expect(newMsg.message.body).toBe('hello?');
    v.close();
    op.ws.close();
  });

  it('queued conversation triggers conversation_queued (when operator away)', async () => {
    // Set operator to 'away' first so conversation status becomes 'queued'
    new OperatorsRepo(db).setStatus(1, 'away');
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    v.send(JSON.stringify({ type: 'chat_message', body: 'hello?' }));
    await new Promise(r => setTimeout(r, 50));
    const queued = op.messages.find(m => m.type === 'conversation_queued');
    expect(queued).toBeDefined();
    expect(queued.conversation.status).toBe('queued');
    v.close();
    op.ws.close();
  });

  it('lead_signal triggers visitor_updated with leadScore', async () => {
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    v.send(JSON.stringify({ type: 'lead_signal', kind: 'calculator_used', payload: {} }));
    await new Promise(r => setTimeout(r, 50));
    const updated = op.messages.find(m => m.type === 'visitor_updated' && m.patch?.leadScore != null);
    expect(updated).toBeDefined();
    expect(updated.patch.leadScore).toBeGreaterThan(0);
    v.close();
    op.ws.close();
  });

  it('visitor close triggers visitor_left', async () => {
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    await new Promise(r => setTimeout(r, 30));
    v.close();
    await new Promise(r => setTimeout(r, 50));
    const left = op.messages.find(m => m.type === 'visitor_left' && m.visitorId === vid);
    expect(left).toBeDefined();
    op.ws.close();
  });
});
