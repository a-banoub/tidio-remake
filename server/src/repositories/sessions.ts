import type { DB } from '../db/client.js';

export type Session = {
  id: string; visitor_id: string; started_at: number; ended_at: number | null;
  landing_url: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  utm_term: string | null; utm_content: string | null;
  gclid: string | null; fbclid: string | null; referrer: string | null;
  ip: string | null; city: string | null; region: string | null; country: string | null; timezone: string | null;
  device_type: string | null; browser: string | null; os: string | null;
  current_lead_score: number;
};

export type CreateSessionInput = Omit<Session, 'ended_at' | 'current_lead_score'>;

export class SessionsRepo {
  constructor(private db: DB) {}

  create(i: CreateSessionInput): void {
    this.db.prepare(`
      INSERT INTO sessions (id, visitor_id, started_at, landing_url,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        gclid, fbclid, referrer, ip,
        city, region, country, timezone,
        device_type, browser, os)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(i.id, i.visitor_id, i.started_at, i.landing_url,
      i.utm_source, i.utm_medium, i.utm_campaign, i.utm_term, i.utm_content,
      i.gclid, i.fbclid, i.referrer, i.ip,
      i.city, i.region, i.country, i.timezone,
      i.device_type, i.browser, i.os);
  }

  findById(id: string): Session | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
  }

  bumpLeadScore(id: string, delta: number): void {
    this.db.prepare('UPDATE sessions SET current_lead_score = current_lead_score + ? WHERE id = ?').run(delta, id);
  }

  end(id: string, ts: number): void {
    this.db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(ts, id);
  }
}
