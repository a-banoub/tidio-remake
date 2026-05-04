import type { Operator } from '../repositories/operators.js';
import { isInQuietHours } from '../quietHours.js';

/**
 * Determine whether to dispatch a Web Push notification to the operator.
 *
 * Policy: push for every visitor message unless the operator is in DND.
 * Each device's service worker then decides whether to actually display the
 * notification (it suppresses display if a console window is focused on that
 * device). Push fan-out is cheap; FCM dedupes; and this avoids the
 * Android-background gap where the PWA's WebSocket is still technically
 * alive but JS is frozen so the in-app notification can't fire.
 *
 * Quiet hours still suppress completely (including DND override semantics
 * are out of scope here — DND is the "I really don't want pings" switch).
 */
export function shouldPushOperator(
  op: Operator | undefined,
  _hasLiveOp: boolean,
  now: Date = new Date(),
): boolean {
  if (!op) return true;
  if (op.status === 'dnd') return false;
  const tz = op.timezone && op.timezone.length > 0 ? op.timezone : 'America/Los_Angeles';
  const inQH = isInQuietHours(op.quiet_hours_start, op.quiet_hours_end, tz, now);
  if (inQH) return false;
  return true;
}
