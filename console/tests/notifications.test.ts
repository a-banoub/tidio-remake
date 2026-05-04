import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock global Notification before importing the module under test
class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => MockNotification.permission);
  title: string;
  options: NotificationOptions | undefined;
  onclick: (() => void) | null = null;
  static instances: MockNotification[] = [];
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    MockNotification.instances.push(this);
  }
  close() {}
}
(globalThis as any).Notification = MockNotification;

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

describe('notifications', () => {
  beforeEach(() => {
    MockNotification.instances = [];
    MockNotification.permission = 'granted';
    playMock.mockClear();
    document.title = 'Console';
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    _resetForTests();
  });

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('fires desktop notification when document is hidden and permission granted', () => {
    notifyVisitorMessage({ name: 'Pat', body: 'hello there' });
    expect(MockNotification.instances).toHaveLength(1);
    expect(MockNotification.instances[0].title).toBe('New message from Pat');
    expect(MockNotification.instances[0].options?.body).toBe('hello there');
  });

  it('uses generic title when name is null', () => {
    notifyVisitorMessage({ name: null, body: 'I have a question' });
    expect(MockNotification.instances[0].title).toBe('New visitor message');
  });

  it('does not fire when document is visible', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    notifyVisitorMessage({ name: 'X', body: 'y' });
    expect(MockNotification.instances).toHaveLength(0);
    expect(document.title).toBe('Console');
  });

  it('flashes title with unread count', () => {
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

  it('plays a ping sound on each notification', () => {
    notifyVisitorMessage({ name: 'A', body: '1' });
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when Notification permission is denied', () => {
    MockNotification.permission = 'denied';
    expect(() => notifyVisitorMessage({ name: 'A', body: '1' })).not.toThrow();
    expect(MockNotification.instances).toHaveLength(0);
  });

  it('requestNotificationPermission short-circuits when already granted', async () => {
    MockNotification.permission = 'granted';
    const reqSpy = MockNotification.requestPermission;
    reqSpy.mockClear();
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(reqSpy).not.toHaveBeenCalled();
  });
});
