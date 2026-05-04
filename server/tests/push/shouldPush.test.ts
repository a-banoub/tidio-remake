import { describe, it, expect } from 'vitest';
import { shouldPushOperator } from '../../src/push/shouldPush.js';
import type { Operator } from '../../src/repositories/operators.js';

function op(overrides: Partial<Operator> = {}): Operator {
  return {
    id: 1,
    email: 'a@b',
    password_hash: 'h',
    display_name: 'A',
    status: 'online',
    timezone: 'America/Los_Angeles',
    quiet_hours_start: null,
    quiet_hours_end: null,
    created_at: 1000,
    ...overrides,
  };
}

describe('shouldPushOperator', () => {
  it('returns true when operator is undefined', () => {
    expect(shouldPushOperator(undefined, false)).toBe(true);
    expect(shouldPushOperator(undefined, true)).toBe(true);
  });

  it('returns true when status is away', () => {
    expect(shouldPushOperator(op({ status: 'away' }), true)).toBe(true);
  });

  it('returns true when status is dnd', () => {
    expect(shouldPushOperator(op({ status: 'dnd' }), true)).toBe(true);
  });

  it('returns true when online but no live websocket', () => {
    expect(shouldPushOperator(op({ status: 'online' }), false)).toBe(true);
  });

  it('returns false when online with a live websocket and no quiet hours', () => {
    expect(shouldPushOperator(op({ status: 'online' }), true)).toBe(false);
  });

  it('returns true when online + live but in quiet hours', () => {
    // 22:00 -> 06:00 in LA; pick a UTC moment that maps to 03:00 LA (in quiet window)
    const inside = new Date('2026-05-03T10:00:00Z'); // 03:00 PDT
    expect(
      shouldPushOperator(
        op({ status: 'online', quiet_hours_start: '22:00', quiet_hours_end: '06:00' }),
        true,
        inside,
      ),
    ).toBe(true);
  });

  it('returns false when online + live and outside quiet hours', () => {
    // 22:00 -> 06:00 in LA; 14:00 LA is outside the window
    const outside = new Date('2026-05-03T21:00:00Z'); // 14:00 PDT
    expect(
      shouldPushOperator(
        op({ status: 'online', quiet_hours_start: '22:00', quiet_hours_end: '06:00' }),
        true,
        outside,
      ),
    ).toBe(false);
  });

  it('falls back to America/Los_Angeles when timezone is empty', () => {
    // empty tz string -> default; quiet hours window 22-06; 03 LA is inside
    const inside = new Date('2026-05-03T10:00:00Z');
    expect(
      shouldPushOperator(
        { ...op({ quiet_hours_start: '22:00', quiet_hours_end: '06:00' }), timezone: '' as any },
        true,
        inside,
      ),
    ).toBe(true);
  });
});
