import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import { ConversationsRepo } from '../repositories/conversations.js';
import { MessagesRepo } from '../repositories/messages.js';
import type { LiveSession } from '../live/sessions.js';
import { parseOperatorMessage } from './operatorProtocol.js';
import { logger } from '../logger.js';

export function authenticateOperatorUpgrade(req: IncomingMessage, deps: ServerDeps): number | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return new OperatorTokensRepo(deps.db).findOperatorIdByToken(token, Date.now()) ?? null;
}

function serializeLive(live: LiveSession) {
  const { sockets, ...rest } = live;
  return { ...rest, socketCount: sockets.size };
}

export function handleOperatorConnection(ws: WebSocket, _req: IncomingMessage, deps: ServerDeps, operatorId: number): void {
  logger.info({ operatorId }, 'operator ws connected');

  ws.on('message', (raw) => {
    const msg = parseOperatorMessage(raw.toString());
    if (!msg) {
      ws.send(JSON.stringify({ type: 'error', code: 'bad_message', message: 'Unrecognized message' }));
      return;
    }

    switch (msg.type) {
      case 'subscribe': {
        deps.oc.add(operatorId, ws);
        const liveVisitors = deps.ls.list().map(serializeLive);
        const conversations = new ConversationsRepo(deps.db);
        const messagesRepo = new MessagesRepo(deps.db);
        const open = conversations.listOpenAndQueued().map(c => ({
          ...c,
          lastMessages: messagesRepo.listByConversation(c.id, 50),
        }));
        ws.send(JSON.stringify({
          type: 'state_snapshot',
          liveVisitors,
          openConversations: open.filter(c => c.status === 'live'),
          queuedConversations: open.filter(c => c.status === 'queued'),
        }));
        break;
      }
      // Other handlers in 4.6+
      default:
        break;
    }
  });

  ws.on('close', () => {
    deps.oc.remove(operatorId, ws);
    logger.debug({ operatorId }, 'operator ws closed');
  });
}
