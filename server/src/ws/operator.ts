import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import { logger } from '../logger.js';

export function authenticateOperatorUpgrade(req: IncomingMessage, deps: ServerDeps): number | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return new OperatorTokensRepo(deps.db).findOperatorIdByToken(token, Date.now()) ?? null;
}

export function handleOperatorConnection(ws: WebSocket, _req: IncomingMessage, _deps: ServerDeps, operatorId: number): void {
  logger.info({ operatorId }, 'operator ws connected');
  ws.on('message', () => { /* implemented in 4.4 */ });
  ws.on('close', () => { logger.debug({ operatorId }, 'operator ws closed'); });
}
