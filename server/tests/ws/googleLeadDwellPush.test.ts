import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import * as pushDispatcher from '../../src/push/dispatcher.js';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('glead-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  server = createServer({
    db,
    ls,
    env: {
      VAPID_PUBLIC_KEY: 'k_pub',
      VAPID_PRIVATE_KEY: 'k_priv',
      VAPID_SUBJECT: 'mailto:t@e.com',
    } as any,
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => {
  vi.restoreAllMocks();
  server.close();
});

async function helloAndWait(ws: WebSocket, payload: any): Promise<any> {
  ws.send(JSON.stringify(payload));
  return new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
}

describe('Google lead 30s dwell push', () => {
  beforeEach(() => {
    process.env.TEST_GOOGLE_LEAD_DWELL_MS = '50';
  });
  afterEach(() => {
    delete process.env.TEST_GOOGLE_LEAD_DWELL_MS;
  });

  it('calls pushToOperator after dwell for a Google Ads visitor', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/lp/start-your-1031', title: 'Start' },
      utms: { gclid: 'abc123' }, referrer: null, userAgent: 'Mozilla/5.0',
    });

    expect(spy).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 200));

    expect(spy).toHaveBeenCalledTimes(1);
    const [_deps, opId, payload] = spy.mock.calls[0];
    expect(opId).toBe(1);
    expect(payload.title).toBe('Google Ads lead on site');
    expect(payload.body).toContain('engaged for 30s');
    expect(payload.url).toBe(`/console/?ping=${visitorId}`);

    spy.mockRestore();
    ws.close();
  }, 5000);

  it('does NOT call pushToOperator when operator is in DND', async () => {
    new OperatorsRepo(db).setStatus(1, 'dnd');
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    ws.close();
  }, 5000);

  it('does NOT call pushToOperator for a non-Google visitor', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    ws.close();
  }, 5000);

  it('cancels the timer if visitor disconnects before dwell', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    });

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  }, 5000);

  it('does not double-send if dwell_notified_at is already set', async () => {
    const spy = vi.spyOn(pushDispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWait(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    });

    // Manually mark as notified before timer fires
    const { SessionsRepo } = await import('../../src/repositories/sessions.js');
    new SessionsRepo(db).markDwellNotified(sessionId, Date.now());

    await new Promise((r) => setTimeout(r, 200));
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    ws.close();
  }, 5000);
});
