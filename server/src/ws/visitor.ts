import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ServerDeps } from '../server.js';
import { parseVisitorMessage } from './protocol.js';
import { VisitorsRepo } from '../repositories/visitors.js';
import { SessionsRepo } from '../repositories/sessions.js';
import { OperatorsRepo } from '../repositories/operators.js';
import { ConversationsRepo } from '../repositories/conversations.js';
import { MessagesRepo } from '../repositories/messages.js';
import { PageViewsRepo } from '../repositories/pageViews.js';
import { LeadSignalsRepo } from '../repositories/leadSignals.js';
import { scoreFor } from '../leadScore/compute.js';
import { logger } from '../logger.js';

type ConnState = { visitorId?: string; sessionId?: string };

export function handleVisitorConnection(ws: WebSocket, req: IncomingMessage, deps: ServerDeps): void {
  const state: ConnState = {};
  const visitors = new VisitorsRepo(deps.db);
  const sessions = new SessionsRepo(deps.db);
  const operators = new OperatorsRepo(deps.db);
  const conversations = new ConversationsRepo(deps.db);
  const _messages = new MessagesRepo(deps.db);

  ws.on('message', (raw) => {
    const msg = parseVisitorMessage(raw.toString());
    if (!msg) {
      ws.send(JSON.stringify({ type: 'error', code: 'bad_message', message: 'Unrecognized message' }));
      return;
    }

    switch (msg.type) {
      case 'hello': {
        state.visitorId = msg.visitorId;
        state.sessionId = msg.sessionId;
        const now = Date.now();
        const ipRaw = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
        visitors.upsert(msg.visitorId, now);
        sessions.create({
          id: msg.sessionId, visitor_id: msg.visitorId, started_at: now,
          landing_url: msg.page.url,
          utm_source: msg.utms.utm_source ?? null,
          utm_medium: msg.utms.utm_medium ?? null,
          utm_campaign: msg.utms.utm_campaign ?? null,
          utm_term: msg.utms.utm_term ?? null,
          utm_content: msg.utms.utm_content ?? null,
          gclid: msg.utms.gclid ?? null,
          fbclid: msg.utms.fbclid ?? null,
          referrer: msg.referrer,
          ip: ipRaw || null,
          city: null, region: null, country: null, timezone: null,
          device_type: null, browser: null, os: null,
        });
        new PageViewsRepo(deps.db).enter(msg.sessionId, msg.page.url, msg.page.title, now);
        deps.ls.add(msg.visitorId, msg.sessionId, ws, { url: msg.page.url, title: msg.page.title, enteredAt: now });

        const op = operators.findById(1);
        const operatorOnline = op?.status === 'online';

        // Look up any open conversation in last 30 days
        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        const existing = conversations.findOpenForVisitor(msg.visitorId, cutoff);

        ws.send(JSON.stringify({
          type: 'welcome',
          operatorOnline,
          conversationId: existing?.id,
          history: existing ? new MessagesRepo(deps.db).listByConversation(existing.id) : [],
        }));
        break;
      }
      case 'presence': {
        if (!state.visitorId || !state.sessionId) break;
        if (msg.page) {
          const live = deps.ls.get(state.visitorId);
          const oldUrl = live?.currentPage.url;
          const now = Date.now();
          if (oldUrl !== msg.page.url) {
            const pvRepo = new PageViewsRepo(deps.db);
            const prev = pvRepo.listForSession(state.sessionId).filter(p => !p.left_at).pop();
            if (prev) pvRepo.leave(prev.id, now);
            pvRepo.enter(state.sessionId, msg.page.url, msg.page.title, now);
            deps.ls.patch(state.visitorId, { currentPage: { url: msg.page.url, title: msg.page.title, enteredAt: now } });
          }
        }
        if (typeof msg.scrollPct === 'number' && state.visitorId) {
          deps.ls.patch(state.visitorId, { scrollPct: msg.scrollPct });
          const pvRepo = new PageViewsRepo(deps.db);
          const cur = pvRepo.listForSession(state.sessionId).filter(p => !p.left_at).pop();
          if (cur) pvRepo.updateScroll(cur.id, msg.scrollPct);
        }
        break;
      }
      case 'lead_signal': {
        if (!state.sessionId || !state.visitorId) break;
        const delta = scoreFor(msg.kind);
        const lsRepo = new LeadSignalsRepo(deps.db);
        lsRepo.insert(state.sessionId, msg.kind, msg.payload, delta, Date.now());
        if (delta > 0) {
          new SessionsRepo(deps.db).bumpLeadScore(state.sessionId, delta);
          const cur = (sessions.findById(state.sessionId)?.current_lead_score ?? 0);
          deps.ls.patch(state.visitorId, { leadScore: cur });
        }
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (state.visitorId) {
      deps.ls.remove(state.visitorId, ws);
      logger.debug({ visitorId: state.visitorId }, 'visitor ws closed');
    }
  });
}
