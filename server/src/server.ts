import express, { type Express } from 'express';
import { createServer as createHttpServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './db/client.js';
import type { LiveSessions } from './live/sessions.js';
import type { Env } from './env.js';
import { logger } from './logger.js';
import { handleVisitorConnection } from './ws/visitor.js';
import { authenticateOperatorUpgrade, handleOperatorConnection } from './ws/operator.js';
import { PhaseTransitionTimers } from './timers/phaseTransition.js';
import { OperatorClients } from './live/operatorClients.js';
import { loginRouter } from './api/login.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDGET_DIST = resolve(__dirname, '..', '..', 'widget', 'dist');

export type ServerDeps = { db: DB; ls: LiveSessions; env: Env; timers: PhaseTransitionTimers; oc: OperatorClients };

export type ServerDepsInput = Omit<ServerDeps, 'timers' | 'oc'> & { timers?: PhaseTransitionTimers; oc?: OperatorClients };

export function createServer(input: ServerDepsInput): Server {
  const deps: ServerDeps = {
    ...input,
    timers: input.timers ?? new PhaseTransitionTimers(),
    oc: input.oc ?? new OperatorClients(),
  };

  const app: Express = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/operator', loginRouter(deps));

  app.use('/widget', express.static(WIDGET_DIST, {
    maxAge: '5m',
    setHeaders: (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); },
  }));

  const server = createHttpServer(app);
  const wssVisitor = new WebSocketServer({ noServer: true });
  const wssOperator = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/ws/visitor') {
      wssVisitor.handleUpgrade(req, socket, head, (ws) => handleVisitorConnection(ws, req, deps));
    } else if (url.pathname === '/ws/operator') {
      const opId = authenticateOperatorUpgrade(req, deps);
      if (opId == null) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
      wssOperator.handleUpgrade(req, socket, head, (ws) => handleOperatorConnection(ws, req, deps, opId));
    } else {
      socket.destroy();
    }
  });

  server.on('listening', () => {
    const addr = server.address();
    logger.info({ addr }, 'server listening');
  });

  return server;
}
