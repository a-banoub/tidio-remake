import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';
import { LeadSignalsRepo } from '../../src/repositories/leadSignals.js';

describe('LeadSignalsRepo', () => {
  it('insert + list', () => {
    const db = makeTestDb('ls');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new SessionsRepo(db).create({ id: 's_1', visitor_id: 'v_a', started_at: 1000, landing_url: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null, ip: null, city: null, region: null, country: null, timezone: null, device_type: null, browser: null, os: null });
    const repo = new LeadSignalsRepo(db);
    repo.insert('s_1', 'calculator_used', { sale: 1200000 }, 3, 1500);
    const rows = repo.listForSession('s_1');
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].payload!).sale).toBe(1200000);
  });
});
