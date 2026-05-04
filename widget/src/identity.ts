const STORAGE_KEY = 's1031_visitor_id';

function hex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^v_[0-9a-f]{12}$/.test(existing)) return existing;
  } catch {}
  const fresh = `v_${hex(6)}`;
  try { localStorage.setItem(STORAGE_KEY, fresh); } catch {}
  return fresh;
}

export function newSessionId(): string {
  return `s_${hex(6)}`;
}
