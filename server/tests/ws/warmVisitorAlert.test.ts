import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { OperatorClients } from '../../src/live/operatorClients.js';
import { WarmVisitorTimers } from '../../src/timers/warmVisitor.js';
import { makeTestDb } from '../helpers/testDb.js';
import { newVisitorId, newSessionId } from '../../src/ids.js';

let server: any;
let port: number;
let db: any;
let ls: LiveSessions;
let oc: OperatorClients;
let warmTimers: WarmVisitorTimers;
let startSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
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
