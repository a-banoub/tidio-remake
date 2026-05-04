import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatWS } from '../src/ws.js';

class MockSocket {
  static instances: MockSocket[] = [];
  onopen?: () => void; onmessage?: (e: { data: string }) => void; onclose?: () => void; onerror?: () => void;
  readyState = 0;
  sent: string[] = [];
  constructor(public url: string) { MockSocket.instances.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 0); }
  send(d: string) { this.sent.push(d); }
  close() { this.readyState = 3; this.onclose?.(); }
}

beforeEach(() => { MockSocket.instances = []; vi.stubGlobal('WebSocket', MockSocket); });

describe('ChatWS', () => {
  it('opens and calls onopen', async () => {
    const onOpen = vi.fn();
    new ChatWS('ws://x', { onOpen, onMessage: () => {}, onClose: () => {} });
    await new Promise(r => setTimeout(r, 5));
    expect(onOpen).toHaveBeenCalled();
  });

  it('queues sends before open and flushes after', async () => {
    const ws = new ChatWS('ws://x', { onOpen: () => {}, onMessage: () => {}, onClose: () => {} });
    ws.send({ type: 'hello' } as any);
    await new Promise(r => setTimeout(r, 5));
    expect(MockSocket.instances[0].sent).toHaveLength(1);
  });
});
