import type { DB } from '../db/client.js';

export type PageView = {
  id: number; session_id: string; url: string; title: string | null;
  entered_at: number; left_at: number | null;
  max_scroll_pct: number; exit_intent: number;
};

export class PageViewsRepo {
  constructor(private db: DB) {}

  enter(sessionId: string, url: string, title: string | null, ts: number): number {
    return Number(this.db.prepare(
      'INSERT INTO page_views (session_id, url, title, entered_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId, url, title, ts).lastInsertRowid);
  }
  leave(id: number, ts: number): void {
    this.db.prepare('UPDATE page_views SET left_at = ? WHERE id = ? AND left_at IS NULL').run(ts, id);
  }
  updateScroll(id: number, pct: number): void {
    this.db.prepare('UPDATE page_views SET max_scroll_pct = MAX(max_scroll_pct, ?) WHERE id = ?').run(pct, id);
  }
  markExitIntent(id: number): void {
    this.db.prepare('UPDATE page_views SET exit_intent = 1 WHERE id = ?').run(id);
  }
  listForSession(sessionId: string): PageView[] {
    return this.db.prepare('SELECT * FROM page_views WHERE session_id = ? ORDER BY entered_at').all(sessionId) as PageView[];
  }
}
