import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WarmVisitorTimers, WARM_VISITOR_DWELL_MS } from '../../src/timers/warmVisitor.js';

describe('WarmVisitorTimers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exports a 90-second default dwell constant', () => {
    expect(WARM_VISITOR_DWELL_MS).toBe(90_000);
  });

  it('fires onFire after the configured delay', () => {
    const t = new WarmVisitorTimers();
    const cb = vi.fn();
    t.start('v_a', 's_1', WARM_VISITOR_DWELL_MS, cb);
    vi.advanceTimersByTime(WARM_VISITOR_DWELL_MS - 1);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('marks session as fired after onFire runs', () => {
    const t = new WarmVisitorTimers();
    t.start('v_a', 's_1', 1000, () => {});
    expect(t.hasFired('s_1')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(t.hasFired('s_1')).toBe(true);
  });

  it('start is a no-op when a timer is already running for the same visitor', () => {
    const t = new WarmVisitorTimers();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    t.start('v_a', 's_1', 1000, cb1);
    t.start('v_a', 's_1', 1000, cb2);
    vi.advanceTimersByTime(1000);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('start is a no-op when the session has already fired', () => {
    const t = new WarmVisitorTimers();
    const cb1 = vi.fn();
    t.start('v_a', 's_1', 1000, cb1);
    vi.advanceTimersByTime(1000);
    const cb2 = vi.fn();
    t.start('v_a', 's_1', 1000, cb2);
    vi.advanceTimersByTime(1000);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('cancel prevents fire', () => {
    const t = new WarmVisitorTimers();
    const cb = vi.fn();
    t.start('v_a', 's_1', 1000, cb);
    t.cancel('v_a');
    vi.advanceTimersByTime(2000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('cancel does not mark session as fired', () => {
    const t = new WarmVisitorTimers();
    t.start('v_a', 's_1', 1000, () => {});
    t.cancel('v_a');
    expect(t.hasFired('s_1')).toBe(false);
  });

  it('clearForSession allows a future start for the same visitor with a new sessionId', () => {
    const t = new WarmVisitorTimers();
    t.start('v_a', 's_1', 1000, () => {});
    vi.advanceTimersByTime(1000);
    expect(t.hasFired('s_1')).toBe(true);
    t.clearForSession('s_1');
    expect(t.hasFired('s_1')).toBe(false);
    const cb = vi.fn();
    t.start('v_a', 's_2', 1000, cb);
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('size reports active timer count', () => {
    const t = new WarmVisitorTimers();
    expect(t.size()).toBe(0);
    t.start('v_a', 's_1', 1000, () => {});
    t.start('v_b', 's_2', 1000, () => {});
    expect(t.size()).toBe(2);
    t.cancel('v_a');
    expect(t.size()).toBe(1);
  });
});
