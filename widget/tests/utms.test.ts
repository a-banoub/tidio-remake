import { describe, it, expect } from 'vitest';
import { parseUtms } from '../src/utms.js';

describe('parseUtms', () => {
  it('extracts utm_* + gclid + fbclid from a search string', () => {
    const u = parseUtms('?utm_source=google_ads&utm_campaign=cal&gclid=ABC');
    expect(u).toEqual({ utm_source: 'google_ads', utm_campaign: 'cal', gclid: 'ABC' });
  });
  it('returns empty object when no relevant params', () => {
    expect(parseUtms('?other=1')).toEqual({});
  });
});
