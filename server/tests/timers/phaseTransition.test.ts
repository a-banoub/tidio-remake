import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhaseTransitionTimers } from '../../src/timers/phaseTransition.js';

describe('PhaseTransitionTimers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after 3 minutes and calls onTimeout', () => {
    const timers = new PhaseTransitionTimers();
    const cb = vi.fn();
    timers.start('c_1', cb);
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents fire', () => {
    const timers = new PhaseTransitionTimers();
    const cb = vi.fn();
    timers.start('c_1', cb);
    timers.cancel('c_1');
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(cb).not.toHaveBeenCalled();
  });
});
