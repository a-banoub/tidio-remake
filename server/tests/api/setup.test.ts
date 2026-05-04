import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

const PEPPER = 'p'.repeat(64);

let server: any, port: number, db: any, ls: LiveSessions;

beforeEach(async () => {
  db = makeTestDb('setup-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  server = createServer({ db, ls, env: { OPERATOR_PASSWORD_PEPPER: PEPPER } as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

function getJson(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

function postJson(path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('GET /api/operator/setup-status', () => {
  it('returns needsSetup: true when no operators exist', async () => {
    const res = await getJson('/api/operator/setup-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsSetup: true });
  });

  it('returns needsSetup: false when an operator exists', async () => {
    new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'x', display_name: 'A', created_at: 1000 });
    const res = await getJson('/api/operator/setup-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsSetup: false });
  });
});

describe('POST /api/operator/setup', () => {
  it('creates the first operator and returns a token', async () => {
    const res = await postJson('/api/operator/setup', {
      email: 'admin@example.com',
      displayName: 'Admin',
      password: 'correct-horse-battery',
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);

    const op = new OperatorsRepo(db).findByEmail('admin@example.com');
    expect(op).toBeTruthy();
    expect(op!.display_name).toBe('Admin');
    // Password hash should NOT be the plaintext.
    expect(op!.password_hash).not.toBe('correct-horse-battery');

    // Token resolves back to the operator id.
    const opId = new OperatorTokensRepo(db).findOperatorIdByToken(res.body.token, Date.now());
    expect(opId).toBe(op!.id);
  });

  it('subsequent setup-status returns needsSetup: false after setup', async () => {
    await postJson('/api/operator/setup', {
      email: 'admin@example.com',
      displayName: 'Admin',
      password: 'correct-horse-battery',
    });
    const status = await getJson('/api/operator/setup-status');
    expect(status.body.needsSetup).toBe(false);
  });

  it('returns 409 when an operator already exists', async () => {
    new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'x', display_name: 'A', created_at: 1000 });
    const res = await postJson('/api/operator/setup', {
      email: 'admin@example.com',
      displayName: 'Admin',
      password: 'correct-horse-battery',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_setup');
  });

  it('returns 400 on malformed body', async () => {
    const res = await postJson('/api/operator/setup', { email: 'not-an-email', displayName: '', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when fields missing', async () => {
    const res = await postJson('/api/operator/setup', {});
    expect(res.status).toBe(400);
  });
});
