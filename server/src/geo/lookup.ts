import { open, type Reader } from 'maxmind';

export type GeoResult = {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
};

let reader: Reader<any> | null = null;

export async function loadGeoDb(path: string | null): Promise<void> {
  if (!path) { reader = null; return; }
  try {
    reader = await open(path);
  } catch {
    reader = null;
  }
}

export function lookup(ip: string | null): GeoResult {
  const empty: GeoResult = { city: null, region: null, country: null, timezone: null };
  if (!reader || !ip) return empty;
  try {
    const r: any = reader.get(ip);
    if (!r) return empty;
    return {
      city: r.city?.names?.en ?? null,
      region: r.subdivisions?.[0]?.names?.en ?? null,
      country: r.country?.iso_code ?? null,
      timezone: r.location?.time_zone ?? null,
    };
  } catch {
    return empty;
  }
}

export function _resetForTests() { reader = null; }
