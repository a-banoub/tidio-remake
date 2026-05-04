import { describe, it, expect, beforeEach } from 'vitest';
import { loadGeoDb, lookup, _resetForTests } from '../../src/geo/lookup.js';

describe('geo lookup', () => {
  beforeEach(() => { _resetForTests(); });

  it('returns null fields when no db is loaded', () => {
    const r = lookup('8.8.8.8');
    expect(r).toEqual({ city: null, region: null, country: null, timezone: null });
  });

  it('returns null fields when ip is null', () => {
    const r = lookup(null);
    expect(r).toEqual({ city: null, region: null, country: null, timezone: null });
  });

  it('handles missing db file gracefully', async () => {
    await loadGeoDb('/nonexistent/path/GeoLite2-City.mmdb');
    const r = lookup('8.8.8.8');
    expect(r).toEqual({ city: null, region: null, country: null, timezone: null });
  });

  it('handles null path', async () => {
    await loadGeoDb(null);
    const r = lookup('8.8.8.8');
    expect(r).toEqual({ city: null, region: null, country: null, timezone: null });
  });
});
