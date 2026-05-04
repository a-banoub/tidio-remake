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

describe('shouldPushOperator (always-push policy)', () => {
  it('returns true when operator is undefined', () => {
    expect(shouldPushOperator(undefined, false)).toBe(true);
    expect(shouldPushOperator(undefined, true)).toBe(true);
  });

  it('returns true when status is online — let the SW decide whether to display', () => {
    expect(shouldPushOperator(op({ status: 'online' }), true)).toBe(true);
    expect(shouldPushOperator(op({ status: 'online' }), false)).toBe(true);
  });

  it('returns true when status is away', () => {
    expect(shouldPushOperator(op({ status: 'away' }), true)).toBe(true);
    expect(shouldPushOperator(op({ status: 'away' }), false)).toBe(true);
  });

  it('returns FALSE when status is dnd — the do-not-disturb switch wins', () => {
    expect(shouldPushOperator(op({ status: 'dnd' }), true)).toBe(false);
    expect(shouldPushOperator(op({ status: 'dnd' }), false)).toBe(false);
  });

  it('returns false during quiet hours (regardless of status)', () => {
    const inside = new Date('2026-05-03T10:00:00Z'); // 03:00 PDT
    expect(
      shouldPushOperator(
        op({ status: 'online', quiet_hours_start: '22:00', quiet_hours_end: '06:00' }),
        true,
        inside,
      ),
    ).toBe(false);
    expect(
      shouldPushOperator(
        op({ status: 'away', quiet_hours_start: '22:00', quiet_hours_end: '06:00' }),
        false,
        inside,
      ),
    ).toBe(false);
  });

  it('returns true outside quiet hours', () => {
    const outside = new Date('2026-05-03T21:00:00Z'); // 14:00 PDT
    expect(
      shouldPushOperator(
        op({ status: 'online', quiet_hours_start: '22:00', quiet_hours_end: '06:00' }),
        true,
        outside,
      ),
    ).toBe(true);
  });

  it('falls back to America/Los_Angeles when timezone is empty', () => {
    const inside = new Date('2026-05-03T10:00:00Z');
    expect(
      shouldPushOperator(
        { ...op({ quiet_hours_start: '22:00', quiet_hours_end: '06:00' }), timezone: '' as any },
        true,
        inside,
      ),
    ).toBe(false);
  });
});
