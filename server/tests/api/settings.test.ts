import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

let server: any, port: number, db: any, ls: LiveSessions, token: string, opId: number;

beforeEach(async () => {
  db = makeTestDb('settings-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  token = 'x'.repeat(64);
  new OperatorTokensRepo(db).create(token, opId, 1000);
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

function put(path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const r = request({ host: '127.0.0.1', port, path, method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

describe('PUT /api/operator/settings', () => {
  it('updates quiet hours and timezone', async () => {
    const res = await put('/api/operator/settings/', { quiet_hours_start: '21:00', quiet_hours_end: '08:00', timezone: 'America/New_York' });
    expect(res.status).toBe(200);
    const op = new OperatorsRepo(db).findById(opId);
    expect(op?.quiet_hours_start).toBe('21:00');
    expect(op?.quiet_hours_end).toBe('08:00');
    expect(op?.timezone).toBe('America/New_York');
  });

  it('rejects invalid time format', async () => {
    const res = await put('/api/operator/settings/', { quiet_hours_start: '25:00' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid timezone', async () => {
    const res = await put('/api/operator/settings/', { timezone: 'NotATimezone' });
    expect(res.status).toBe(400);
  });

  it('clears quiet hours when empty string passed', async () => {
    new OperatorsRepo(db).setQuietHours(opId, '21:00', '08:00');
    const res = await put('/api/operator/settings/', { quiet_hours_start: '', quiet_hours_end: '' });
    expect(res.status).toBe(200);
    expect(new OperatorsRepo(db).findById(opId)?.quiet_hours_start).toBeNull();
  });
});
