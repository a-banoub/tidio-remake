const KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'] as const;

export type Utms = Partial<Record<typeof KEYS[number], string>>;

export function parseUtms(search: string): Utms {
  const params = new URLSearchParams(search);
  const out: Utms = {};
  for (const k of KEYS) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}
