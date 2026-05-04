import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';
import { PageViewsRepo } from '../../src/repositories/pageViews.js';

describe('PageViewsRepo', () => {
  it('enter + updateScroll + leave', () => {
    const db = makeTestDb('pv');
    new VisitorsRepo(db).upsert('v_a', 1000);
    new SessionsRepo(db).create({ id: 's_1', visitor_id: 'v_a', started_at: 1000, landing_url: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null, ip: null, city: null, region: null, country: null, timezone: null, device_type: null, browser: null, os: null });
    const repo = new PageViewsRepo(db);
    const id = repo.enter('s_1', '/index.html', 'Home', 1000);
    repo.updateScroll(id, 50);
    repo.updateScroll(id, 30); // shouldn't lower
    repo.leave(id, 2000);
    const rows = repo.listForSession('s_1');
    expect(rows[0].max_scroll_pct).toBe(50);
    expect(rows[0].left_at).toBe(2000);
  });
});
