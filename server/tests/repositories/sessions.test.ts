import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';

describe('SessionsRepo', () => {
  it('create + findById + bumpLeadScore', () => {
    const db = makeTestDb('s1');
    new VisitorsRepo(db).upsert('v_a', 1000);
    const repo = new SessionsRepo(db);
    repo.create({ id: 's_1', visitor_id: 'v_a', started_at: 1000, landing_url: '/x', utm_source: 'g', utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null, ip: '1.1.1.1', city: 'LV', region: 'NV', country: 'US', timezone: 'America/Los_Angeles', device_type: 'desktop', browser: 'Chrome', os: 'macOS' });
    expect(repo.findById('s_1')?.utm_source).toBe('g');
    repo.bumpLeadScore('s_1', 3); repo.bumpLeadScore('s_1', 2);
    expect(repo.findById('s_1')?.current_lead_score).toBe(5);
  });
});
