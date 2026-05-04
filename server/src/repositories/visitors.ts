import type { DB } from '../db/client.js';

export type Visitor = {
  id: string; first_seen_at: number; last_seen_at: number;
  name: string | null; email: string | null; phone: string | null;
  hubspot_contact_id: string | null;
};

export class VisitorsRepo {
  constructor(private db: DB) {}

  upsert(id: string, ts: number): void {
    this.db.prepare(`
      INSERT INTO visitors (id, first_seen_at, last_seen_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at
    `).run(id, ts, ts);
  }

  findById(id: string): Visitor | undefined {
    return this.db.prepare('SELECT * FROM visitors WHERE id = ?').get(id) as Visitor | undefined;
  }

  updateContact(id: string, patch: { name?: string; email?: string; phone?: string }): void {
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (!sets.length) return;
    vals.push(id);
    this.db.prepare(`UPDATE visitors SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
}
