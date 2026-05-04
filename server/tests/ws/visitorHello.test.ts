import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('visws-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  server = createServer({ db, ls, env: { VISITOR_COOKIE_SECRET: 'a'.repeat(64) } as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

describe('visitor WS hello', () => {
  it('responds with welcome and creates visitor + session rows', async () => {
    const visitorId = newVisitorId(), sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/index.html', title: 'Home' },
      utms: { utm_source: 'google_ads' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    const welcome: any = await new Promise(r => ws.on('message', m => r(JSON.parse(m.toString()))));
    expect(welcome.type).toBe('welcome');
    expect(welcome.operatorOnline).toBeDefined();
    const v = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitorId);
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    expect(v).toBeDefined();
    expect(s.utm_source).toBe('google_ads');
    ws.close();
  });
});
