export const WARM_VISITOR_DWELL_MS = 90_000;

/**
 * Per-visitor scheduling for the warm-visitor alert.
 *
 * `start` is a no-op when:
 *   - a timer is already pending for that visitorId, OR
 *   - the sessionId has already fired in this process lifetime.
 *
 * The fired set is keyed by sessionId (not visitorId) so a returning visitor
 * with a fresh session can fire again.
 */
export class WarmVisitorTimers {
  private timers = new Map<string, NodeJS.Timeout>();
  private fired = new Set<string>();

  start(visitorId: string, sessionId: string, ms: number, onFire: () => void): void {
    if (this.timers.has(visitorId)) return;
    if (this.fired.has(sessionId)) return;
    const handle = setTimeout(() => {
      this.timers.delete(visitorId);
      this.fired.add(sessionId);
      onFire();
    }, ms);
    this.timers.set(visitorId, handle);
  }

  cancel(visitorId: string): void {
    const handle = this.timers.get(visitorId);
    if (handle) {
      clearTimeout(handle);
      this.timers.delete(visitorId);
    }
  }

  hasFired(sessionId: string): boolean {
    return this.fired.has(sessionId);
  }

  clearForSession(sessionId: string): void {
    this.fired.delete(sessionId);
  }

  size(): number {
    return this.timers.size;
  }
}
