import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { OperatorClients } from '../../src/live/operatorClients.js';
import { WarmVisitorTimers } from '../../src/timers/warmVisitor.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';
import { _resetForTests as _resetArrivalDedupe } from '../../src/push/recentArrivalDedupe.js';

let server: any;
let port: number;
let db: any;
let ls: LiveSessions;
let oc: OperatorClients;
let warmTimers: WarmVisitorTimers;
let startSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  _resetArrivalDedupe();
  db = makeTestDb('warm-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  oc = new OperatorClients();
  warmTimers = new WarmVisitorTimers();
  startSpy = vi.spyOn(warmTimers, 'start');
  server = createServer({
    db, ls, oc, warmTimers,
    env: { VISITOR_COOKIE_SECRET: 'a'.repeat(64) } as any,
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => {
  startSpy.mockRestore();
  server.close();
});

async function helloAndWaitForWelcome(ws: WebSocket, payload: any): Promise<any> {
  ws.send(JSON.stringify(payload));
  return new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
}

describe('warm-visitor alert: hello hook', () => {
  it('starts the timer on hello when initial lead score > 0 (gclid → google_ads_click +3)', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/index.html', title: 'Home' },
      utms: { gclid: 'abc' }, referrer: null, userAgent: 'Mozilla/5.0',
    });
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(visitorId, sessionId, 90_000, expect.any(Function));
    ws.close();
  });

  it('does NOT start the timer on hello when score = 0 (no auto signals)', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });
    expect(startSpy).not.toHaveBeenCalled();
    ws.close();
  });
});

describe('warm-visitor alert: lead_signal hook', () => {
  it('starts the timer when a lead_signal pushes score from 0 to positive', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });
    expect(startSpy).not.toHaveBeenCalled();
    // Send a lead signal whose kind has positive score in compute.ts:
    ws.send(JSON.stringify({ type: 'lead_signal', kind: 'pricing_page_view', payload: null }));
    // Allow event-loop turn for the message to be processed
    await new Promise((r) => setTimeout(r, 50));
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(visitorId, sessionId, 90_000, expect.any(Function));
    ws.close();
  });

  it('does NOT start the timer for a lead_signal with zero delta', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloAndWaitForWelcome(ws, {
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/about', title: 'About' },
      utms: {}, referrer: null, userAgent: 'Mozilla/5.0',
    });
    ws.send(JSON.stringify({ type: 'lead_signal', kind: 'unknown_signal', payload: null }));
    await new Promise((r) => setTimeout(r, 50));
    expect(startSpy).not.toHaveBeenCalled();
    ws.close();
  });
});

describe('warm-visitor alert: cancel hooks', () => {
  let cancelSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    cancelSpy = vi.spyOn(warmTimers, 'cancel');
  });
  afterEach(() => cancelSpy.mockRestore());

  async function helloWithGclid(ws: WebSocket, visitorId: string, sessionId: string) {
    ws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'Home' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    await new Promise((r) => ws.on('message', (m) => r(JSON.parse(m.toString()))));
  }

  it('cancels the timer on chat_open', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloWithGclid(ws, visitorId, sessionId);
    expect(startSpy).toHaveBeenCalledTimes(1);
    ws.send(JSON.stringify({ type: 'chat_open' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
    ws.close();
  });

  it('cancels the timer on the visitor first chat_message', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloWithGclid(ws, visitorId, sessionId);
    ws.send(JSON.stringify({ type: 'chat_message', body: 'Hi there' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
    ws.close();
  });

  it('cancels the timer on ws close', async () => {
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await helloWithGclid(ws, visitorId, sessionId);
    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
  });
});

describe('warm-visitor alert: operator open_chat cancel', () => {
  it('cancels the timer when operator opens a chat with a warm visitor', async () => {
    // Seed an operator + token so we can connect as operator
    const opsRepo = new (await import('../../src/repositories/operators.js')).OperatorsRepo(db);
    const tokenRepo = new (await import('../../src/repositories/operatorTokens.js')).OperatorTokensRepo(db);
    const opId = opsRepo.create({ email: 'a@b', password_hash: 'x', display_name: 'A', created_at: 1000 });
    const token = 'tok_' + Math.random().toString(36).slice(2);
    tokenRepo.create(token, opId, Date.now() + 60_000);

    const cancelSpy = vi.spyOn(warmTimers, 'cancel');

    // Visitor connects + triggers warm timer
    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const vws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => vws.on('open', () => r()));
    vws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/', title: 'H' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    await new Promise((r) => vws.on('message', (m) => r(JSON.parse(m.toString()))));

    // Operator connects and opens chat for this visitor
    const ows = new WebSocket(`ws://127.0.0.1:${port}/ws/operator?token=${token}`);
    await new Promise<void>((r) => ows.on('open', () => r()));
    ows.send(JSON.stringify({ type: 'subscribe' }));
    await new Promise((r) => setTimeout(r, 50));
    ows.send(JSON.stringify({ type: 'open_chat', visitorId }));
    await new Promise((r) => setTimeout(r, 100));

    expect(cancelSpy).toHaveBeenCalledWith(visitorId);
    cancelSpy.mockRestore();
    vws.close();
    ows.close();
  });
});

describe('warm-visitor alert: fire path', () => {
  beforeEach(() => {
    process.env.TEST_WARM_VISITOR_DWELL_MS = '50';
  });
  afterEach(() => {
    delete process.env.TEST_WARM_VISITOR_DWELL_MS;
  });

  it('emits warm_visitor_alert + calls pushToOperator after dwell elapses', async () => {
    const dispatcher = await import('../../src/push/dispatcher.js');
    const pushSpy = vi.spyOn(dispatcher, 'pushToOperator').mockResolvedValue(undefined);

    const opsRepo = new (await import('../../src/repositories/operators.js')).OperatorsRepo(db);
    const opId = opsRepo.create({
      email: 'a@b', password_hash: 'x', display_name: 'A', created_at: Date.now(),
    });

    const tokenRepo = new (await import('../../src/repositories/operatorTokens.js')).OperatorTokensRepo(db);
    const token = 'tok_' + Math.random().toString(36).slice(2);
    tokenRepo.create(token, opId, Date.now() + 60_000);

    const seenAlerts: any[] = [];
    const ows = new WebSocket(`ws://127.0.0.1:${port}/ws/operator?token=${token}`);
    await new Promise<void>((r) => ows.on('open', () => r()));
    ows.send(JSON.stringify({ type: 'subscribe' }));
    ows.on('message', (m) => {
      const parsed = JSON.parse(m.toString());
      if (parsed.type === 'warm_visitor_alert') seenAlerts.push(parsed);
    });
    await new Promise((r) => setTimeout(r, 50));

    const visitorId = newVisitorId();
    const sessionId = newSessionId();
    const vws = new WebSocket(`ws://127.0.0.1:${port}/ws/visitor`);
    await new Promise<void>((r) => vws.on('open', () => r()));
    vws.send(JSON.stringify({
      type: 'hello', visitorId, sessionId,
      page: { url: 'https://simple1031x.com/lp/start-your-1031', title: 'Start' },
      utms: { gclid: 'x' }, referrer: null, userAgent: 'Mozilla/5.0',
    }));
    await new Promise((r) => vws.on('message', (m) => r(JSON.parse(m.toString()))));

    // Wait > 50ms for the timer to fire
    await new Promise((r) => setTimeout(r, 200));

    expect(seenAlerts).toHaveLength(1);
    expect(seenAlerts[0]).toMatchObject({
      type: 'warm_visitor_alert',
      visitorId,
      sessionId,
      reason: 'warm_dwell_90s',
    });
    expect(seenAlerts[0].leadScore).toBeGreaterThan(0);
    expect(seenAlerts[0].page).toContain('/lp/start-your-1031');

    const warmCalls = pushSpy.mock.calls.filter(c => (c[2] as any).title === 'Warm visitor on site');
    expect(warmCalls).toHaveLength(1);
    expect(warmCalls[0][1]).toBe(1); // server always pushes to op#1
    expect(warmCalls[0][2]).toMatchObject({
      title: 'Warm visitor on site',
      url: `/console/?ping=${visitorId}`,
    });

    pushSpy.mockRestore();
    vws.close();
    ows.close();
  }, 5000);
});
