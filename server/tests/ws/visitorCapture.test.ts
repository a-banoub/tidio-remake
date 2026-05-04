import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { PhaseTransitionTimers } from '../../src/timers/phaseTransition.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any, port: number, db: any, ls: LiveSessions, timers: PhaseTransitionTimers;

beforeEach(async () => {
  db = makeTestDb('cap-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  timers = new PhaseTransitionTimers();
  server = createServer({ db, ls, timers, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

describe('visitor capture', () => {
  it('capture writes contact info to visitors row + timeout_capture', async () => {
    const vid = newVisitorId(), sid = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({ type: 'hello', visitorId: vid, sessionId: sid, page: { url: 'https://simple1031x.com/x', title: 'X' }, utms: {}, referrer: null, userAgent: 'M' }));
    await new Promise(r => ws.once('message', () => r(null)));
    ws.send(JSON.stringify({ type: 'chat_message', body: 'hello?' }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({ type: 'capture', name: 'Mike H.', email: 'mike@example.com', phone: '555-1234' }));
    await new Promise(r => setTimeout(r, 50));
    const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(vid) as any;
    expect(v.name).toBe('Mike H.');
    expect(v.email).toBe('mike@example.com');
    const c = db.prepare('SELECT * FROM conversations WHERE visitor_id = ?').get(vid) as any;
    expect(c.timeout_capture).toContain('mike@example.com');
    expect(c.status).toBe('closed_for_followup');
    ws.close();
  });
});
