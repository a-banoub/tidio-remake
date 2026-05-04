import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server.js';
import type { Server } from 'node:http';
import { request } from 'node:http';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer({ db: {} as any, ls: {} as any, env: { PORT: 0 } as any });
  await new Promise<void>(r => server.listen(0, () => r()));
  port = (server.address() as any).port;
});

afterAll(() => { server.close(); });

describe('http server', () => {
  it('GET /health returns 200', async () => {
    const res = await new Promise<any>((resolve) => {
      const req = request({ host: '127.0.0.1', port, path: '/health' }, resolve);
      req.end();
    });
    expect(res.statusCode).toBe(200);
  });
});
