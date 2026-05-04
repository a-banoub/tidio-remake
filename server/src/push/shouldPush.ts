import type { Operator } from '../repositories/operators.js';
import { isInQuietHours } from '../quietHours.js';

/**
 * Determine whether to dispatch a Web Push notification to the operator
 * based on their current availability state and quiet hours.
 *
 * @param op       The operator row (or undefined if not found)
 * @param hasLiveOp True if at least one operator websocket is connected
 * @param now      Optional current Date (defaults to new Date())
 */
export function shouldPushOperator(
  op: Operator | undefined,
  hasLiveOp: boolean,
  now: Date = new Date(),
): boolean {
  if (!op) return true;
  if (op.status !== 'online') return true;
  if (!hasLiveOp) return true;
  const tz = op.timezone && op.timezone.length > 0 ? op.timezone : 'America/Los_Angeles';
  const inQH = isInQuietHours(op.quiet_hours_start, op.quiet_hours_end, tz, now);
  if (inQH) return true;
  return false;
}
