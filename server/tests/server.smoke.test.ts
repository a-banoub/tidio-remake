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

  it('GET /console/* does not crash even when console/dist is absent', async () => {
    // Confirms the static mount + SPA fallback is registered without throwing
    // at app construction time. Whether the fallback returns 200 or 404 depends
    // on whether the console has been built; the important property is that
    // express handled the route rather than the server crashing on boot.
    const res = await new Promise<any>((resolve) => {
      const req = request({ host: '127.0.0.1', port, path: '/console/' }, resolve);
      req.end();
    });
    expect([200, 404]).toContain(res.statusCode);
  });
});
