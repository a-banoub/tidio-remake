const recentlyPushed = new Map<string, number>();
const WINDOW_MS = 5 * 60 * 1000;

export function shouldPushArrival(visitorId: string, now = Date.now()): boolean {
  const last = recentlyPushed.get(visitorId);
  if (last && now - last < WINDOW_MS) return false;
  recentlyPushed.set(visitorId, now);
  return true;
}

// Periodic sweep — call from server boot
export function startArrivalDedupeSweep(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const [k, v] of recentlyPushed) {
      if (now - v > WINDOW_MS) recentlyPushed.delete(k);
    }
  }, intervalMs).unref();
}

export function _resetForTests() { recentlyPushed.clear(); }
