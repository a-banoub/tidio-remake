const KEY = 's1031_chat_v2';

export type StoredMsg = { id: number | string; sender: 'visitor' | 'operator' | 'system'; body: string; sent_at: number };

export type Stored = { messages: StoredMsg[]; openedAt: number; conversationId?: string };

export class ConvStore {
  load(): Stored | null {
    try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  save(s: Stored): void {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }
  clear(): void { try { sessionStorage.removeItem(KEY); } catch {} }
}
