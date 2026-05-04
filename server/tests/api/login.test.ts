import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { hashPassword } from '../../src/auth/password.js';

const PEPPER = 'p'.repeat(64);

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('login-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  // seed operator with known hashed password
  const hash = await hashPassword('correct-horse', PEPPER);
  new OperatorsRepo(db).create({ email: 'op@example.com', password_hash: hash, display_name: 'Alex', created_at: 1000 });
  server = createServer({ db, ls, env: { OPERATOR_PASSWORD_PEPPER: PEPPER } as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

function postJson(path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('POST /api/operator/login', () => {
  it('returns token on correct credentials', async () => {
    const res = await postJson('/api/operator/login', { email: 'op@example.com', password: 'correct-horse' });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.displayName).toBe('Alex');
  });

  it('returns 401 on wrong password', async () => {
    const res = await postJson('/api/operator/login', { email: 'op@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 400 on malformed body', async () => {
    const res = await postJson('/api/operator/login', { email: 123 });
    expect(res.status).toBe(400);
  });

  it('rate-limits after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await postJson('/api/operator/login', { email: 'op@example.com', password: 'wrong' });
    }
    const res = await postJson('/api/operator/login', { email: 'op@example.com', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});
