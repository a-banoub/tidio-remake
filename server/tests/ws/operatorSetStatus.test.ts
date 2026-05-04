import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer } from '../../src/server.js';
import { LiveSessions } from '../../src/live/sessions.js';
import { makeTestDb } from '../helpers/testDb.js';
import { OperatorsRepo } from '../../src/repositories/operators.js';
import { OperatorTokensRepo } from '../../src/repositories/operatorTokens.js';

let server: any, port: number, db: any, ls: LiveSessions, validToken: string, opId: number;

beforeEach(async () => {
  db = makeTestDb('opss-' + Math.random().toString(36).slice(2));
  ls = new LiveSessions();
  opId = new OperatorsRepo(db).create({ email: 'a@b', password_hash: 'h', display_name: 'A', created_at: 1000 });
  validToken = 's'.repeat(64);
  new OperatorTokensRepo(db).create(validToken, opId, 1000);
  server = createServer({ db, ls, env: {} as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = server.address().port;
});
afterEach(() => server.close());

describe('operator set_status', () => {
  it('updates DB row + broadcasts status_changed', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/operator`, { headers: { authorization: `Bearer ${validToken}` } });
    const messages: any[] = [];
    ws.on('message', m => messages.push(JSON.parse(m.toString())));
    await new Promise<void>(r => ws.on('open', () => r()));
    ws.send(JSON.stringify({ type: 'subscribe' }));
    await new Promise(r => setTimeout(r, 30));
    ws.send(JSON.stringify({ type: 'set_status', status: 'away' }));
    await new Promise(r => setTimeout(r, 50));
    expect(messages.find(m => m.type === 'status_changed' && m.status === 'away')).toBeDefined();
    expect(new OperatorsRepo(db).findById(opId)?.status).toBe('away');
    ws.close();
  });
});
