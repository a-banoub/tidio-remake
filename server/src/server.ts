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
import { WarmVisitorTimers } from './timers/warmVisitor.js';
import { OperatorClients } from './live/operatorClients.js';
import { loginRouter } from './api/login.js';
import { quickRepliesRouter } from './api/quickReplies.js';
import { visitorDetailRouter } from './api/visitorDetail.js';
import { settingsRouter } from './api/settings.js';
import { pushSubscribeRouter } from './api/pushSubscribe.js';
import { setupRouter } from './api/setup.js';
import { closedConversationsRouter } from './api/closedConversations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDGET_DIST = resolve(__dirname, '..', '..', 'widget', 'dist');
const CONSOLE_DIST = resolve(__dirname, '..', '..', 'console', 'dist');

export type ServerDeps = {
  db: DB;
  ls: LiveSessions;
  env: Env;
  timers: PhaseTransitionTimers;
  oc: OperatorClients;
  warmTimers: WarmVisitorTimers;
};

export type ServerDepsInput = Omit<ServerDeps, 'timers' | 'oc' | 'warmTimers'> & {
  timers?: PhaseTransitionTimers;
  oc?: OperatorClients;
  warmTimers?: WarmVisitorTimers;
};

export function createServer(input: ServerDepsInput): Server {
  const deps: ServerDeps = {
    ...input,
    timers: input.timers ?? new PhaseTransitionTimers(),
    oc: input.oc ?? new OperatorClients(),
    warmTimers: input.warmTimers ?? new WarmVisitorTimers(),
  };

  const app: Express = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Bare-domain visits land on the operator console. Mobile browsers in
  // particular often visit chat.simple1031x.com without the /console/ path
  // and would otherwise see a 404.
  app.get('/', (_req, res) => res.redirect(302, '/console/'));

  app.use('/api/operator', setupRouter(deps));
  app.use('/api/operator', loginRouter(deps));
  app.use('/api/operator', pushSubscribeRouter(deps));
  app.use('/api/operator/quick-replies', quickRepliesRouter(deps));
  app.use('/api/operator/visitor', visitorDetailRouter(deps));
  app.use('/api/operator/settings', settingsRouter(deps));
  app.use('/api/operator/conversations', closedConversationsRouter(deps));

  app.use('/widget', express.static(WIDGET_DIST, {
    maxAge: '5m',
    setHeaders: (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); },
  }));

  app.use('/console', express.static(CONSOLE_DIST, {
    maxAge: '5m',
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (path.endsWith('sw.js')) {
        // Service workers can't be cached aggressively
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback for /console/* — serve index.html for unknown paths under /console
  app.get('/console/*', (_req, res, next) => {
    // Don't override real files — express.static already handled those.
    // For unknown paths under /console, send index.html.
    res.sendFile(resolve(CONSOLE_DIST, 'index.html'), (err) => { if (err) next(); });
  });

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
