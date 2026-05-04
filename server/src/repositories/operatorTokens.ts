import type { DB } from '../db/client.js';

export class OperatorTokensRepo {
  constructor(private db: DB) {}

  create(token: string, operatorId: number, ts: number): void {
    this.db.prepare('INSERT INTO operator_tokens (token, operator_id, created_at) VALUES (?, ?, ?)').run(token, operatorId, ts);
  }

  findOperatorIdByToken(token: string, ts: number): number | undefined {
    const row = this.db.prepare('SELECT operator_id FROM operator_tokens WHERE token = ?').get(token) as any;
    if (!row) return undefined;
    this.db.prepare('UPDATE operator_tokens SET last_used_at = ? WHERE token = ?').run(ts, token);
    return row.operator_id;
  }

  revoke(token: string): void {
    this.db.prepare('DELETE FROM operator_tokens WHERE token = ?').run(token);
  }
}
