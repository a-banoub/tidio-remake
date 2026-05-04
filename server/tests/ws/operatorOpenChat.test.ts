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
  db = makeTestDb('opoc-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'Alex', created_at: 1000 });
  validToken = 'o'.repeat(64);
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

describe('operator open_chat (proactive ping)', () => {
  it('error when visitor offline', async () => {
    const op = await connectOperator();
    op.ws.send(JSON.stringify({ type: 'open_chat', visitorId: 'v_000000000000' }));
    await new Promise(r => setTimeout(r, 50));
    const err = op.messages.find(m => m.type === 'error' && m.code === 'visitor_offline');
    expect(err).toBeDefined();
    op.ws.close();
  });

  it('creates conversation + first operator message becomes operator_pinged_you', async () => {
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    op.ws.send(JSON.stringify({ type: 'open_chat', visitorId: vid }));
    await new Promise(r => setTimeout(r, 50));
    const opened = op.messages.find(m => m.type === 'conversation_opened');
    expect(opened).toBeDefined();
    const cid = opened.conversationId;
    op.ws.send(JSON.stringify({ type: 'send_message', conversationId: cid, body: 'Hi! Saw you reading…' }));
    await new Promise(r => setTimeout(r, 50));
    const ping = v.messages.find(m => m.type === 'operator_pinged_you');
    expect(ping).toBeDefined();
    expect(ping.body).toBe('Hi! Saw you reading…');
    // Second message should be regular operator_message
    op.ws.send(JSON.stringify({ type: 'send_message', conversationId: cid, body: 'Anything I can help with?' }));
    await new Promise(r => setTimeout(r, 50));
    const second = v.messages.find(m => m.type === 'operator_message');
    expect(second).toBeDefined();
    v.ws.close();
    op.ws.close();
  });

  it('visitor-initiated conversation: send_message stays operator_message (not pinged)', async () => {
    const op = await connectOperator();
    const vid = newVisitorId(), sid = newSessionId();
    const v = await connectVisitor(vid, sid);
    v.ws.send(JSON.stringify({ type: 'chat_message', body: 'hi' }));
    await new Promise(r => setTimeout(r, 50));
    const conv = db.prepare('SELECT id FROM conversations WHERE visitor_id = ?').get(vid) as any;
    op.ws.send(JSON.stringify({ type: 'send_message', conversationId: conv.id, body: 'Hello!' }));
    await new Promise(r => setTimeout(r, 50));
    const opMsg = v.messages.find(m => m.type === 'operator_message');
    const pingMsg = v.messages.find(m => m.type === 'operator_pinged_you');
    expect(opMsg).toBeDefined();
    expect(pingMsg).toBeUndefined();
    v.ws.close();
    op.ws.close();
  });
});
