import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

let server: any, port: number, db: any, ls: LiveSessions, token: string;

beforeEach(async () => {
  db = makeTestDb('qr-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  token = 'q'.repeat(64);
  new OperatorTokensRepo(db).create(token, opId, 1000);
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

function req(method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers: any = { 'Authorization': `Bearer ${token}` };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const r = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode!, body: chunks ? JSON.parse(chunks) : null }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('quick replies REST', () => {
  it('rejects without bearer token', async () => {
    const res = await new Promise<number>((resolve) => {
      const r = request({ host: '127.0.0.1', port, path: '/api/operator/quick-replies/', method: 'GET' }, (res) => resolve(res.statusCode!));
      r.end();
    });
    expect(res).toBe(401);
  });

  it('CRUD roundtrip', async () => {
    expect((await req('GET', '/api/operator/quick-replies/')).body).toEqual([]);
    const created = await req('POST', '/api/operator/quick-replies/', { label: 'Greet', body: 'Hi there!' });
    expect(created.status).toBe(200);
    const id = created.body.id;
    let list = (await req('GET', '/api/operator/quick-replies/')).body;
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Greet');
    await req('PUT', `/api/operator/quick-replies/${id}`, { label: 'Hello' });
    list = (await req('GET', '/api/operator/quick-replies/')).body;
    expect(list[0].label).toBe('Hello');
    await req('DELETE', `/api/operator/quick-replies/${id}`);
    expect((await req('GET', '/api/operator/quick-replies/')).body).toEqual([]);
  });
});
