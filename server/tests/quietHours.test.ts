import { describe, it, expect } from 'vitest';
import { isInQuietHours } from '../src/quietHours.js';

describe('isInQuietHours', () => {
  it('returns false when start or end is null', () => {
    expect(isInQuietHours(null, '08:00', 'UTC')).toBe(false);
    expect(isInQuietHours('21:00', null, 'UTC')).toBe(false);
  });

  it('same-day window: 09:00-17:00', () => {
    // 12:00 UTC = inside
    const noon = new Date('2026-05-03T12:00:00Z');
    expect(isInQuietHours('09:00', '17:00', 'UTC', noon)).toBe(true);
    // 18:00 UTC = outside
    const evening = new Date('2026-05-03T18:00:00Z');
    expect(isInQuietHours('09:00', '17:00', 'UTC', evening)).toBe(false);
  });

  it('overnight window: 21:00-08:00', () => {
    const lateNight = new Date('2026-05-03T23:00:00Z');
    expect(isInQuietHours('21:00', '08:00', 'UTC', lateNight)).toBe(true);
    const earlyMorning = new Date('2026-05-03T07:00:00Z');
    expect(isInQuietHours('21:00', '08:00', 'UTC', earlyMorning)).toBe(true);
    const noon = new Date('2026-05-03T12:00:00Z');
    expect(isInQuietHours('21:00', '08:00', 'UTC', noon)).toBe(false);
  });

  it('respects timezone (LA at midnight UTC = 17:00 PST in May)', () => {
    // May = PDT (UTC-7). 00:00 UTC = 17:00 PDT = inside 09:00-18:00
    const utcMidnight = new Date('2026-05-03T00:00:00Z');
    expect(isInQuietHours('09:00', '18:00', 'America/Los_Angeles', utcMidnight)).toBe(true);
  });
});
