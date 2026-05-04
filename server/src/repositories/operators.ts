import type { DB } from '../db/client.js';

export type OperatorStatus = 'online' | 'away' | 'dnd';

export type Operator = {
  id: number; email: string; password_hash: string; display_name: string;
  status: OperatorStatus; timezone: string;
  quiet_hours_start: string | null; quiet_hours_end: string | null;
  created_at: number;
};

export class OperatorsRepo {
  constructor(private db: DB) {}

  create(i: { email: string; password_hash: string; display_name: string; timezone?: string; created_at: number }): number {
    return Number(this.db.prepare(`
      INSERT INTO operators (email, password_hash, display_name, timezone, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(i.email, i.password_hash, i.display_name, i.timezone ?? 'America/Los_Angeles', i.created_at).lastInsertRowid);
  }

  findByEmail(email: string): Operator | undefined {
    return this.db.prepare('SELECT * FROM operators WHERE email = ?').get(email) as Operator | undefined;
  }
  findById(id: number): Operator | undefined {
    return this.db.prepare('SELECT * FROM operators WHERE id = ?').get(id) as Operator | undefined;
  }
  setStatus(id: number, status: OperatorStatus): void {
    this.db.prepare('UPDATE operators SET status = ? WHERE id = ?').run(status, id);
  }
  setQuietHours(id: number, start: string | null, end: string | null): void {
    this.db.prepare('UPDATE operators SET quiet_hours_start = ?, quiet_hours_end = ? WHERE id = ?').run(start, end, id);
  }
  countAll(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM operators').get() as any).c;
  }
}
