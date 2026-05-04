import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

let server: any, port: number, db: any, ls: LiveSessions, validToken: string;

beforeEach(async () => {
  db = makeTestDb('opauth-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  const opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  validToken = 't'.repeat(64);
  new OperatorTokensRepo(db).create(validToken, opId, 1000);
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});

afterEach(() => server.close());

describe('operator WS auth', () => {
  it('rejects connection without bearer token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`);
    const result = await new Promise<string>((resolve) => {
      ws.on('error', () => resolve('error'));
      ws.on('unexpected-response', (_, res) => resolve(`unexpected:${res.statusCode}`));
      ws.on('open', () => resolve('open'));
    });
    expect(result).toMatch(/^(unexpected:401|error)$/);
  });

  it('rejects connection with invalid bearer token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`, { headers: { authorization: 'Bearer wrongtoken' } });
    const result = await new Promise<string>((resolve) => {
      ws.on('error', () => resolve('error'));
      ws.on('unexpected-response', (_, res) => resolve(`unexpected:${res.statusCode}`));
      ws.on('open', () => resolve('open'));
    });
    expect(result).toMatch(/^(unexpected:401|error)$/);
  });

  it('accepts connection with valid bearer token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`, { headers: { authorization: `Bearer ${validToken}` } });
    const result = await new Promise<string>((resolve) => {
      ws.on('error', () => resolve('error'));
      ws.on('unexpected-response', () => resolve('unexpected'));
      ws.on('open', () => resolve('open'));
    });
    expect(result).toBe('open');
    ws.close();
  });
});
