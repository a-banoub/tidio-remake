import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  notifyVisitorMessage,
  notifyVisitorArrived,
  _resetForTests,
  setOperatorStatusForNotifications,
} from '../src/notifications.js';

// Mock AudioContext for jsdom
class MockOsc { connect = vi.fn(); start = vi.fn(); stop = vi.fn(); frequency = { value: 0 }; type = 'sine' as OscillatorType; }
class MockGain { connect = vi.fn(); gain = { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }; }
const mockOscFactory = vi.fn(() => new MockOsc());
const mockGainFactory = vi.fn(() => new MockGain());
class MockAudioContext {
  destination = {};
  currentTime = 0;
  state: 'suspended' | 'running' = 'running';
  createOscillator = mockOscFactory;
  createGain = mockGainFactory;
  resume = vi.fn().mockResolvedValue(undefined);
}

describe('notifications', () => {
  beforeEach(() => {
    _resetForTests();
    setOperatorStatusForNotifications('online');
    mockOscFactory.mockClear(); mockGainFactory.mockClear();
    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).webkitAudioContext = MockAudioContext;
  });

  it('plays ping on visitor message regardless of focus', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    notifyVisitorMessage({ name: 'A', body: 'hi' });
    expect(mockOscFactory).toHaveBeenCalled();
  });

  it('plays a different-frequency arrival ping on new visitor', () => {
    notifyVisitorArrived({ name: 'B', page: '/' });
    expect(mockOscFactory).toHaveBeenCalled();
    const osc = mockOscFactory.mock.results[0].value as MockOsc;
    expect(osc.frequency.value).toBeLessThan(700); // arrival is lower than 880 message ping
  });

  it('does NOT play any ping when operator is in DND', () => {
    setOperatorStatusForNotifications('dnd');
    notifyVisitorMessage({ name: 'A', body: 'hi' });
    notifyVisitorArrived({ name: 'B', page: '/' });
    expect(mockOscFactory).not.toHaveBeenCalled();
  });

  it('plays message ping at higher freq than arrival ping', () => {
    notifyVisitorMessage({ name: 'A', body: 'hi' });
    notifyVisitorArrived({ name: 'B', page: '/' });
    expect(mockOscFactory).toHaveBeenCalledTimes(2);
    const messageOsc = mockOscFactory.mock.results[0].value as MockOsc;
    const arrivalOsc = mockOscFactory.mock.results[1].value as MockOsc;
    expect(messageOsc.frequency.value).toBeGreaterThan(arrivalOsc.frequency.value);
  });

  it('does NOT call new Notification (SW push handles OS notifications)', () => {
    const ctor = vi.fn();
    (globalThis as any).Notification = ctor;
    notifyVisitorMessage({ name: 'Pat', body: 'hi' });
    expect(ctor).not.toHaveBeenCalled();
    delete (globalThis as any).Notification;
  });

  it('flashes title with unread count when hidden', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.title = 'Console';
    _resetForTests();
    setOperatorStatusForNotifications('online');
    mockOscFactory.mockClear();
    notifyVisitorMessage({ name: 'A', body: '1' });
    notifyVisitorMessage({ name: 'A', body: '2' });
    expect(document.title).toMatch(/^\(2\) /);
  });

  it('clearUnread restores original title', async () => {
    const { clearUnread } = await import('../src/notifications.js');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.title = 'Console';
    _resetForTests();
    setOperatorStatusForNotifications('online');
    notifyVisitorMessage({ name: 'A', body: '1' });
    expect(document.title).not.toBe('Console');
    clearUnread();
    expect(document.title).toBe('Console');
  });

  it('requestNotificationPermission still works for SW push subscription', async () => {
    const { requestNotificationPermission } = await import('../src/notifications.js');
    const reqSpy = vi.fn(async () => 'granted' as NotificationPermission);
    (globalThis as any).Notification = { permission: 'default', requestPermission: reqSpy };
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(reqSpy).toHaveBeenCalled();
    delete (globalThis as any).Notification;
  });
});
