import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import * as pushDispatcher from '../../src/push/dispatcher.js';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { _resetForTests as _resetArrivalDedupe } from '../../src/push/recentArrivalDedupe.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  _resetArrivalDedupe();
  db = makeTestDb('arrival-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  server = createServer({
    db, ls,
    env: { VAPID_PUBLIC_KEY: 'k_pub', VAPID_PRIVATE_KEY: 'k_priv', VAPID_SUBJECT: 'mailto:t@e.com' } as any,
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => { vi.restoreAllMocks(); server.close(); });

async function helloAndWait(ws: WebSocket, payload: any): Promise<any> {
  ws.send(JSON.stringify(payload));
  return new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
}

describe('visitor arrival push', () => {
  it('pushes once per visitor on hello', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);
    const visitorId = newVisitorId(), sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, { type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0' });
    await new Promise(r => setTimeout(r, 50));
    const arrivalCalls = spy.mock.calls.filter(c => (c[2] as any).title === 'New visitor on site');
    expect(arrivalCalls).toHaveLength(1);
    expect((arrivalCalls[0][2] as any).body).toContain('/');
    ws.close();
  }, 5000);

  it('does NOT push if operator is in DND', async () => {
    new OperatorsRepo(db).setStatus(1, 'dnd');
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);
    const visitorId = newVisitorId(), sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, { type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0' });
    await new Promise(r => setTimeout(r, 50));
    const arrivalCalls = spy.mock.calls.filter(c => (c[2] as any).title === 'New visitor on site');
    expect(arrivalCalls).toHaveLength(0);
    ws.close();
  }, 5000);

  it('dedupes pushes within 5 min for same visitor', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);
    const visitorId = newVisitorId();
    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
      await new Promise<void>((r) => ws.on('open', () => r()));
      await helloAndWait(ws, { type: 'hello', visitorId, sessionId: newSessionId(),
        page: { url: 'https://simple1031x.com/', title: 'Home' },
        utms: {}, referrer: null, userAgent: 'Mozilla/5.0' });
      ws.close();
      await new Promise(r => setTimeout(r, 30));
    }
    const arrivalCalls = spy.mock.calls.filter(c => (c[2] as any).title === 'New visitor on site');
    expect(arrivalCalls).toHaveLength(1);
  }, 5000);
});
