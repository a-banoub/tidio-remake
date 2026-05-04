import type { DB } from '../db/client.js';

export type QuickReply = { id: number; operator_id: number; label: string; body: string; sort_order: number };

export class QuickRepliesRepo {
  constructor(private db: DB) {}

  list(operatorId: number): QuickReply[] {
    return this.db.prepare('SELECT * FROM quick_replies WHERE operator_id = ? ORDER BY sort_order, id').all(operatorId) as QuickReply[];
  }

  create(operatorId: number, label: string, body: string, sortOrder: number): number {
    return Number(this.db.prepare('INSERT INTO quick_replies (operator_id, label, body, sort_order) VALUES (?, ?, ?, ?)').run(operatorId, label, body, sortOrder).lastInsertRowid);
  }

  update(id: number, patch: { label?: string; body?: string; sort_order?: number }): void {
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (!sets.length) return;
    vals.push(id);
    this.db.prepare(`UPDATE quick_replies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM quick_replies WHERE id = ?').run(id);
  }
}
