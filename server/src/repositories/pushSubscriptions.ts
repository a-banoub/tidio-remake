import type { DB } from '../db/client.js';

export type PushSubscriptionRow = {
  id: number; operator_id: number; endpoint: string;
  p256dh: string; auth: string; device_label: string | null;
  created_at: number; last_used_at: number | null;
  last_push_ok_at: number | null;
  last_push_fail_reason: string | null;
  last_push_fail_at: number | null;
};

export class PushSubscriptionsRepo {
  constructor(private db: DB) {}

  upsert(i: { operator_id: number; endpoint: string; p256dh: string; auth: string; device_label?: string; created_at: number }): void {
    this.db.prepare(`
      INSERT INTO push_subscriptions (operator_id, endpoint, p256dh, auth, device_label, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label
    `).run(i.operator_id, i.endpoint, i.p256dh, i.auth, i.device_label ?? null, i.created_at);
  }

  listForOperator(operatorId: number): PushSubscriptionRow[] {
    return this.db.prepare('SELECT * FROM push_subscriptions WHERE operator_id = ?').all(operatorId) as PushSubscriptionRow[];
  }

  deleteByEndpoint(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  bumpLastUsed(id: number, ts: number): void {
    this.db.prepare('UPDATE push_subscriptions SET last_used_at = ? WHERE id = ?').run(ts, id);
  }

  recordOk(id: number, ts: number): void {
    this.db.prepare('UPDATE push_subscriptions SET last_push_ok_at = ?, last_used_at = ? WHERE id = ?').run(ts, ts, id);
  }

  recordFail(id: number, reason: string, ts: number): void {
    this.db.prepare('UPDATE push_subscriptions SET last_push_fail_reason = ?, last_push_fail_at = ? WHERE id = ?').run(reason, ts, id);
  }
}
