import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('vas-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

async function helloAndWait(vid: string, sid: string, page = 'https://simple1031x.com/x', utms: any = {}): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
  await new Promise<void>(r => ws.on('open', () => r()));
  ws.send(JSON.stringify({ type: 'hello', visitorId: vid, sessionId: sid, page: { url: page, title: 'X' }, utms, referrer: null, userAgent: 'M' }));
  await new Promise(r => ws.once('message', () => r(null)));
  return ws;
}

describe('auto-derived lead signals on hello', () => {
  it('fires returning_visitor when first_seen_at > 24h ago', async () => {
    // Pre-seed a visitor with old first_seen_at
    const vid = newVisitorId();
    new VisitorsRepo(db).upsert(vid, Date.now() - 48 * 60 * 60 * 1000); // 48h ago
    const ws = await helloAndWait(vid, newSessionId());
    await new Promise(r => setTimeout(r, 50));
    const sigs = db.prepare("SELECT kind FROM lead_signals WHERE kind = 'returning_visitor'").all();
    expect(sigs).toHaveLength(1);
    ws.close();
  });

  it('does not fire returning_visitor for brand-new visitor', async () => {
    const ws = await helloAndWait(newVisitorId(), newSessionId());
    await new Promise(r => setTimeout(r, 50));
    const sigs = db.prepare("SELECT kind FROM lead_signals WHERE kind = 'returning_visitor'").all();
    expect(sigs).toHaveLength(0);
    ws.close();
  });

  it('fires google_ads_click when gclid present', async () => {
    const ws = await helloAndWait(newVisitorId(), newSessionId(), 'https://simple1031x.com/x', { gclid: 'ABC123' });
    await new Promise(r => setTimeout(r, 50));
    const sigs = db.prepare("SELECT kind FROM lead_signals WHERE kind = 'google_ads_click'").all();
    expect(sigs).toHaveLength(1);
    ws.close();
  });

  it('fires pricing_page_view when URL matches /pricing', async () => {
    const ws = await helloAndWait(newVisitorId(), newSessionId(), 'https://simple1031x.com/pricing');
    await new Promise(r => setTimeout(r, 50));
    const sigs = db.prepare("SELECT kind FROM lead_signals WHERE kind = 'pricing_page_view'").all();
    expect(sigs).toHaveLength(1);
    ws.close();
  });
});
