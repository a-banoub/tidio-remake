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
  db = makeTestDb('opact-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'Alex', created_at: 1000 });
  validToken = 'a'.repeat(64);
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

async function connectVisitor(vid: string, sid: string): Promise<{ ws: WebSocket; messages: any[] }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
  const messages: any[] = [];
  ws.on('message', m => messages.push(JSON.parse(m.toString())));
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({
    type: 'hello', visitorId: vid, sessionId: sid,
    page: { url: 'https://simple1031x.com/x', title: 'X' },
    utms: {}, referrer: null, userAgent: 'M',
  }));
  await new Promise(r => setTimeout(r, 30));
  return { ws, messages };
}

async function startConv(visitor: { ws: WebSocket; messages: any[] }): Promise<string> {
  visitor.ws.send(JSON.stringify({ type: 'chat_message', body: 'hi' }));
  await new Promise(r => setTimeout(r, 50));
  // Look up the conversation in DB
  const conv = db.prepare('SELECT id FROM conversations LIMIT 1').get() as any;
  return conv.id;
}

describe('operator actions', () => {
  it('send_message reaches the visitor as operator_message', async () => {
    const op = await connectOperator();
    const v = await connectVisitor(newVisitorId(), newSessionId());
    const cid = await startConv(v);
    op.ws.send(JSON.stringify({ type: 'send_message', conversationId: cid, body: 'How can I help?' }));
    await new Promise(r => setTimeout(r, 50));
    const opMsg = v.messages.find(m => m.type === 'operator_message');
    expect(opMsg).toBeDefined();
    expect(opMsg.body).toBe('How can I help?');
    v.ws.close();
    op.ws.close();
  });

  it('send_message on queued conversation transitions to live', async () => {
    new OperatorsRepo(db).setStatus(1, 'away'); // force queued
    const op = await connectOperator();
    const v = await connectVisitor(newVisitorId(), newSessionId());
    const cid = await startConv(v);
    expect((db.prepare('SELECT status FROM conversations WHERE id = ?').get(cid) as any).status).toBe('queued');
    op.ws.send(JSON.stringify({ type: 'send_message', conversationId: cid, body: 'I am here' }));
    await new Promise(r => setTimeout(r, 50));
    expect((db.prepare('SELECT status FROM conversations WHERE id = ?').get(cid) as any).status).toBe('live');
    v.ws.close();
    op.ws.close();
  });

  it('operator typing reaches visitor as operator_typing', async () => {
    const op = await connectOperator();
    const v = await connectVisitor(newVisitorId(), newSessionId());
    const cid = await startConv(v);
    op.ws.send(JSON.stringify({ type: 'typing', conversationId: cid, isTyping: true }));
    await new Promise(r => setTimeout(r, 50));
    const t = v.messages.find(m => m.type === 'operator_typing');
    expect(t).toBeDefined();
    expect(t.isTyping).toBe(true);
    v.ws.close();
    op.ws.close();
  });

  it('update_visitor writes to DB', async () => {
    const op = await connectOperator();
    const vid = newVisitorId();
    const v = await connectVisitor(vid, newSessionId());
    op.ws.send(JSON.stringify({ type: 'update_visitor', visitorId: vid, name: 'Mike', email: 'm@x.com' }));
    await new Promise(r => setTimeout(r, 50));
    const row = db.prepare('SELECT * FROM visitors WHERE id = ?').get(vid) as any;
    expect(row.name).toBe('Mike');
    expect(row.email).toBe('m@x.com');
    v.ws.close();
    op.ws.close();
  });

  it('end_chat closes conversation + sends system msg to visitor', async () => {
    const op = await connectOperator();
    const v = await connectVisitor(newVisitorId(), newSessionId());
    const cid = await startConv(v);
    op.ws.send(JSON.stringify({ type: 'end_chat', conversationId: cid }));
    await new Promise(r => setTimeout(r, 50));
    expect((db.prepare('SELECT status FROM conversations WHERE id = ?').get(cid) as any).status).toBe('closed');
    const sys = v.messages.find(m => m.type === 'system');
    expect(sys).toBeDefined();
    expect(sys.body).toContain('ended');
    v.ws.close();
    op.ws.close();
  });

  it('end_chat broadcasts full conversation object to operator (new shape)', async () => {
    const op = await connectOperator();
    const v = await connectVisitor(newVisitorId(), newSessionId());
    const cid = await startConv(v);
    // Clear messages collected so far (subscribe snapshot etc.)
    op.messages.length = 0;
    op.ws.send(JSON.stringify({ type: 'end_chat', conversationId: cid }));
    await new Promise(r => setTimeout(r, 50));
    const closed = op.messages.find(m => m.type === 'conversation_closed');
    expect(closed).toBeDefined();
    // New shape: must include a full conversation object, not just conversationId
    expect(closed.conversation).toBeDefined();
    expect(closed.conversation.id).toBe(cid);
    expect(closed.conversation.status).toBe('closed');
    expect(Array.isArray(closed.conversation.lastMessages)).toBe(true);
    expect('last_message_preview' in closed.conversation).toBe(true);
    // Legacy conversationId field should NOT be present at the top level
    expect(closed.conversationId).toBeUndefined();
    v.ws.close();
    op.ws.close();
  });
});
