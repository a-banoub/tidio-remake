import type { DB } from '../db/client.js';

export type MessageSender = 'visitor' | 'operator' | 'system';

export type Message = {
  id: number; conversation_id: string; sender: MessageSender;
  body: string; sent_at: number; seen_at: number | null;
  quick_reply_id: number | null;
};

export class MessagesRepo {
  constructor(private db: DB) {}

  insert(i: { conversation_id: string; sender: MessageSender; body: string; sent_at: number; quick_reply_id?: number | null }): Message {
    const id = Number(this.db.prepare(`
      INSERT INTO messages (conversation_id, sender, body, sent_at, quick_reply_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(i.conversation_id, i.sender, i.body, i.sent_at, i.quick_reply_id ?? null).lastInsertRowid);
    return this.findById(id)!;
  }

  findById(id: number): Message | undefined {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined;
  }

  listByConversation(conversationId: string, limit = 100): Message[] {
    return this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY sent_at LIMIT ?').all(conversationId, limit) as Message[];
  }

  markSeen(id: number, ts: number): void {
    this.db.prepare('UPDATE messages SET seen_at = ? WHERE id = ? AND seen_at IS NULL').run(ts, id);
  }

  markAllSeenInConversation(conversationId: string, upToId: number, ts: number): void {
    this.db.prepare(`
      UPDATE messages SET seen_at = ?
      WHERE conversation_id = ? AND id <= ? AND seen_at IS NULL AND sender = 'visitor'
    `).run(ts, conversationId, upToId);
  }
}
