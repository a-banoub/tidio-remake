import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('vp-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
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

describe('visitor presence + lead_signal', () => {
  it('presence with new page creates a page_view row', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await helloAndWait(ws, vid, sid);
    ws.send(JSON.stringify({ type: 'presence', page: { url: 'https://simple1031x.com/y', title: 'Y' }, scrollPct: 25 }));
    await new Promise(r => setTimeout(r, 50));
    const pvs = db.prepare('SELECT * FROM page_views WHERE session_id = ?').all(sid);
    expect(pvs.length).toBeGreaterThanOrEqual(1);
    expect(pvs.find((p: any) => p.url.endsWith('/y'))).toBeDefined();
    ws.close();
  });

  it('lead_signal inserts and bumps score', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await helloAndWait(ws, vid, sid);
    ws.send(JSON.stringify({ type: 'lead_signal', kind: 'calculator_used', payload: { sale: 1200000 } }));
    await new Promise(r => setTimeout(r, 50));
    const sigs = db.prepare('SELECT * FROM lead_signals WHERE session_id = ?').all(sid);
    expect(sigs).toHaveLength(1);
    const session = db.prepare('SELECT current_lead_score FROM sessions WHERE id = ?').get(sid) as any;
    expect(session.current_lead_score).toBeGreaterThan(0);
    ws.close();
  });
});
