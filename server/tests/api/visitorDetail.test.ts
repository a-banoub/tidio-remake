import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { VisitorsRepo } from '../../src/repositories/visitors.js';
import { SessionsRepo } from '../../src/repositories/sessions.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

let server: any, port: number, db: any, ls: LiveSessions, token: string;

beforeEach(async () => {
  db = makeTestDb('vd-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  token = 'v'.repeat(64);
  new OperatorTokensRepo(db).create(token, opId, 1000);
  // Seed
  new VisitorsRepo(db).upsert('v_aaaaaaaaaaaa', 1000);
  new VisitorsRepo(db).updateContact('v_aaaaaaaaaaaa', { name: 'Mike' });
  new SessionsRepo(db).create({
    id: 's_aaaaaaaaaaaa', visitor_id: 'v_aaaaaaaaaaaa', started_at: 1500,
    landing_url: '/x', utm_source: null, utm_medium: null, utm_campaign: null,
    utm_term: null, utm_content: null, gclid: null, fbclid: null, referrer: null,
    ip: null, city: null, region: null, country: null, timezone: null,
    device_type: null, browser: null, os: null,
  });
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, path, method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    r.on('error', reject);
    r.end();
  });
}

describe('visitor detail REST', () => {
  it('returns visitor + session + page_views + lead_signals + conversations', async () => {
    const res = await get('/api/operator/visitor/v_aaaaaaaaaaaa');
    expect(res.status).toBe(200);
    expect(res.body.visitor.name).toBe('Mike');
    expect(res.body.session.id).toBe('s_aaaaaaaaaaaa');
    expect(res.body.pageViews).toEqual([]);
    expect(res.body.leadSignals).toEqual([]);
    expect(res.body.recentConversations).toEqual([]);
  });

  it('returns 404 for unknown visitor', async () => {
    const res = await get('/api/operator/visitor/v_nonexistent');
    expect(res.status).toBe(404);
  });
});
