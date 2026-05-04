import type { DB } from '../db/client.js';

export type ConversationStatus = 'live' | 'queued' | 'closed' | 'abandoned' | 'closed_for_followup';
export type ConversationInitiator = 'visitor' | 'operator';

export type Conversation = {
  id: string; visitor_id: string; opened_session_id: string | null;
  status: ConversationStatus; opened_at: number; closed_at: number | null;
  last_message_at: number; initiated_by: ConversationInitiator;
  timeout_capture: string | null;
};

export class ConversationsRepo {
  constructor(private db: DB) {}

  create(i: { id: string; visitor_id: string; opened_session_id: string | null; status: ConversationStatus; opened_at: number; initiated_by: ConversationInitiator }): void {
    this.db.prepare(`
      INSERT INTO conversations (id, visitor_id, opened_session_id, status, opened_at, last_message_at, initiated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(i.id, i.visitor_id, i.opened_session_id, i.status, i.opened_at, i.opened_at, i.initiated_by);
  }

  findById(id: string): Conversation | undefined {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
  }

  setStatus(id: string, status: ConversationStatus, ts: number): void {
    if (['closed', 'abandoned', 'closed_for_followup'].includes(status)) {
      this.db.prepare('UPDATE conversations SET status = ?, closed_at = ? WHERE id = ?').run(status, ts, id);
    } else {
      this.db.prepare('UPDATE conversations SET status = ? WHERE id = ?').run(status, id);
    }
  }

  bumpLastMessageAt(id: string, ts: number): void {
    this.db.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?').run(ts, id);
  }

  setTimeoutCapture(id: string, capture: { name?: string; email?: string; phone?: string }): void {
    this.db.prepare('UPDATE conversations SET timeout_capture = ? WHERE id = ?').run(JSON.stringify(capture), id);
  }

  findOpenForVisitor(visitorId: string, sinceTs: number): Conversation | undefined {
    return this.db.prepare(`
      SELECT * FROM conversations
      WHERE visitor_id = ? AND status IN ('live','queued') AND last_message_at >= ?
      ORDER BY last_message_at DESC LIMIT 1
    `).get(visitorId, sinceTs) as Conversation | undefined;
  }

  listOpenAndQueued(): Conversation[] {
    return this.db.prepare("SELECT * FROM conversations WHERE status IN ('live','queued') ORDER BY last_message_at DESC").all() as Conversation[];
  }
}
