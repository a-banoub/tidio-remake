import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';
import { OperatorTokensRepo } from '../repositories/operatorTokens.js';
import { ConversationsRepo } from '../repositories/conversations.js';
import { MessagesRepo } from '../repositories/messages.js';
import { VisitorsRepo } from '../repositories/visitors.js';
import { OperatorsRepo } from '../repositories/operators.js';
import type { LiveSession } from '../live/sessions.js';
import { parseOperatorMessage } from './operatorProtocol.js';
import { logger } from '../logger.js';
import { newConversationId } from '../ids.js';

export function authenticateOperatorUpgrade(req: IncomingMessage, deps: ServerDeps): number | null {
  // Try Authorization: Bearer <token> first
  const auth = req.headers['authorization'];
  let token: string | null = null;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else {
    // Fallback to ?token= query string
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      token = url.searchParams.get('token');
    } catch {}
  }
  if (!token) return null;
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
      case 'open_chat': {
        const visitorId = msg.visitorId;
        const live = deps.ls.get(visitorId);
        if (!live) {
          deps.oc.broadcastTo(operatorId, { type: 'error', code: 'visitor_offline', visitorId });
          break;
        }
        const cutoff = Date.now() - 60_000;
        const conversationsRepo = new ConversationsRepo(deps.db);
        const existing = conversationsRepo.findOpenForVisitor(visitorId, cutoff);
        if (existing) {
          deps.warmTimers.cancel(visitorId);
          deps.oc.broadcastTo(operatorId, { type: 'conversation_opened', conversationId: existing.id });
          break;
        }
        const cid = newConversationId();
        conversationsRepo.create({
          id: cid, visitor_id: visitorId, opened_session_id: live.activeSessionId,
          status: 'live', opened_at: Date.now(), initiated_by: 'operator',
        });
        deps.ls.patch(visitorId, { conversationId: cid });
        const newConv = conversationsRepo.findById(cid);
        if (newConv) deps.oc.broadcastTo(operatorId, { type: 'conversation_added', conversation: newConv });
        deps.oc.broadcastTo(operatorId, { type: 'conversation_opened', conversationId: cid });
        deps.warmTimers.cancel(visitorId);
        break;
      }

      case 'send_message': {
        const conversationsRepo = new ConversationsRepo(deps.db);
        const conv = conversationsRepo.findById(msg.conversationId);
        if (!conv) return;
        const messagesRepo = new MessagesRepo(deps.db);
        const isFirstOperatorMsg = conv.initiated_by === 'operator'
          && messagesRepo.listByConversation(conv.id).every(m => m.sender !== 'operator');
        const now = Date.now();
        const m = messagesRepo.insert({
          conversation_id: msg.conversationId, sender: 'operator',
          body: msg.body, sent_at: now, quick_reply_id: msg.quickReplyId ?? null,
        });
        conversationsRepo.bumpLastMessageAt(msg.conversationId, now);
        if (conv.status === 'queued') {
          conversationsRepo.setStatus(msg.conversationId, 'live', now);
          deps.timers.cancel(msg.conversationId);
        }
        // Fan out to visitor's sockets
        const live = deps.ls.get(conv.visitor_id);
        const visitorPayload = JSON.stringify(
          isFirstOperatorMsg
            ? { type: 'operator_pinged_you', messageId: m.id, body: m.body, operatorName: 'Alex', sentAt: now }
            : { type: 'operator_message', messageId: m.id, body: m.body, operatorName: 'Alex', sentAt: now }
        );
        if (live) for (const sock of live.sockets) try { sock.send(visitorPayload); } catch {}
        // Echo back to operator (so other operator tabs see it)
        deps.oc.broadcastTo(operatorId, { type: 'new_message', conversationId: conv.id, message: m });
        break;
      }

      case 'typing': {
        const conv = new ConversationsRepo(deps.db).findById(msg.conversationId);
        if (!conv) return;
        const live = deps.ls.get(conv.visitor_id);
        const payload = JSON.stringify({ type: 'operator_typing', isTyping: msg.isTyping });
        if (live) for (const sock of live.sockets) try { sock.send(payload); } catch {}
        break;
      }

      case 'mark_seen': {
        new MessagesRepo(deps.db).markAllSeenInConversation(msg.conversationId, msg.lastMessageId, Date.now());
        const conv = new ConversationsRepo(deps.db).findById(msg.conversationId);
        if (!conv) return;
        const live = deps.ls.get(conv.visitor_id);
        const payload = JSON.stringify({ type: 'seen', messageId: msg.lastMessageId, seenAt: Date.now() });
        if (live) for (const sock of live.sockets) try { sock.send(payload); } catch {}
        break;
      }

      case 'update_visitor': {
        const norm = (v: string | undefined) => (v === undefined || v === '' ? null : v);
        const patch = { name: norm(msg.name), email: norm(msg.email), phone: norm(msg.phone) };
        new VisitorsRepo(deps.db).updateContact(msg.visitorId, { name: msg.name, email: msg.email, phone: msg.phone });
        logger.info({ operatorId, visitorId: msg.visitorId, ...patch }, 'visitor contact updated');
        deps.oc.broadcastTo(operatorId, { type: 'visitor_updated', visitorId: msg.visitorId, patch });
        break;
      }

      case 'end_chat': {
        const conversationsRepo = new ConversationsRepo(deps.db);
        conversationsRepo.setStatus(msg.conversationId, 'closed', Date.now());
        deps.timers.cancel(msg.conversationId);
        const conv = conversationsRepo.findById(msg.conversationId);
        if (conv) {
          const live = deps.ls.get(conv.visitor_id);
          if (live) for (const sock of live.sockets) try { sock.send(JSON.stringify({ type: 'system', body: 'This conversation has ended. Thanks for chatting!' })); } catch {}
        }
        deps.oc.broadcastTo(operatorId, { type: 'conversation_closed', conversationId: msg.conversationId });
        break;
      }

      case 'set_status': {
        new OperatorsRepo(deps.db).setStatus(operatorId, msg.status);
        deps.oc.broadcastTo(operatorId, { type: 'status_changed', status: msg.status });
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    deps.oc.remove(operatorId, ws);
    logger.debug({ operatorId }, 'operator ws closed');
  });
}
