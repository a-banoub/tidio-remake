import type { DB } from '../db/client.js';

export type LeadSignal = {
  id: number; session_id: string; kind: string;
  payload: string | null; score_delta: number; created_at: number;
};

export class LeadSignalsRepo {
  constructor(private db: DB) {}

  insert(sessionId: string, kind: string, payload: unknown, scoreDelta: number, ts: number): number {
    return Number(this.db.prepare(
      'INSERT INTO lead_signals (session_id, kind, payload, score_delta, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, kind, payload === undefined ? null : JSON.stringify(payload), scoreDelta, ts).lastInsertRowid);
  }

  listForSession(sessionId: string): LeadSignal[] {
    return this.db.prepare('SELECT * FROM lead_signals WHERE session_id = ? ORDER BY created_at').all(sessionId) as LeadSignal[];
  }
}
