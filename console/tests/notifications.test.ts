import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const playMock = vi.fn();
class MockAudio {
  src: string;
  volume = 1;
  currentTime = 0;
  constructor(src: string) { this.src = src; }
  play() { playMock(); return Promise.resolve(); }
}
(globalThis as any).Audio = MockAudio;

import { notifyVisitorMessage, requestNotificationPermission, clearUnread, _resetForTests } from '../src/notifications.js';

describe('notifications (in-page only — SW handles OS notifications)', () => {
  beforeEach(() => {
    playMock.mockClear();
    document.title = 'Console';
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    _resetForTests();
  });

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('does NOT call new Notification (SW push handles OS notifications)', () => {
    const ctor = vi.fn();
    (globalThis as any).Notification = ctor;
    notifyVisitorMessage({ name: 'Pat', body: 'hi' });
    expect(ctor).not.toHaveBeenCalled();
    delete (globalThis as any).Notification;
  });

  it('plays a ping sound when document is hidden', () => {
    notifyVisitorMessage({ name: 'A', body: '1' });
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('does not play sound when document is visible', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    notifyVisitorMessage({ name: 'A', body: '1' });
    expect(playMock).not.toHaveBeenCalled();
  });

  it('flashes title with unread count when hidden', () => {
    notifyVisitorMessage({ name: 'A', body: '1' });
    notifyVisitorMessage({ name: 'A', body: '2' });
    expect(document.title).toMatch(/^\(2\) /);
  });

  it('clearUnread restores original title', () => {
    notifyVisitorMessage({ name: 'A', body: '1' });
    expect(document.title).not.toBe('Console');
    clearUnread();
    expect(document.title).toBe('Console');
  });

  it('requestNotificationPermission still works for SW push subscription', async () => {
    const reqSpy = vi.fn(async () => 'granted' as NotificationPermission);
    (globalThis as any).Notification = { permission: 'default', requestPermission: reqSpy };
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(reqSpy).toHaveBeenCalled();
    delete (globalThis as any).Notification;
  });
});
