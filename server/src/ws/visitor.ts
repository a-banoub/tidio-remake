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
import { WARM_VISITOR_DWELL_MS } from '../timers/warmVisitor.js';
import { newConversationId } from '../ids.js';
import { logger } from '../logger.js';
import { lookup } from '../geo/lookup.js';
import UAParser from 'ua-parser-js';
import * as pushDispatcher from '../push/dispatcher.js';
import { shouldPushOperator } from '../push/shouldPush.js';

type ConnState = { visitorId?: string; sessionId?: string };

function dwellMsForEnv(): number {
  const override = process.env.TEST_WARM_VISITOR_DWELL_MS;
  if (override && /^\d+$/.test(override)) return Number(override);
  return WARM_VISITOR_DWELL_MS;
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

export function handleVisitorConnection(ws: WebSocket, req: IncomingMessage, deps: ServerDeps): void {
  const state: ConnState = {};
  const visitors = new VisitorsRepo(deps.db);
  const sessions = new SessionsRepo(deps.db);
  const operators = new OperatorsRepo(deps.db);
  const conversations = new ConversationsRepo(deps.db);
  const _messages = new MessagesRepo(deps.db);

  function fireWarmVisitorAlert(visitorId: string, sessionId: string, currentPageUrl: string): void {
    const session = sessions.findById(sessionId);
    const leadScore = session?.current_lead_score ?? 0;
    const dwellMs = dwellMsForEnv();
    const page = currentPageUrl;
    const alert = {
      type: 'warm_visitor_alert' as const,
      visitorId,
      sessionId,
      leadScore,
      page,
      dwellMs,
      reason: 'warm_dwell_90s' as const,
    };
    deps.oc.broadcastTo(1, alert);
    pushDispatcher
      .pushToOperator(deps, 1, {
        title: 'Warm visitor on site',
        body: `${pathOf(page)} · score ${leadScore}, here ${Math.round(dwellMs / 1000)}s`,
        url: `/console/?ping=${visitorId}`,
      })
      .catch((err) => logger.warn({ err }, 'warm-visitor push failed'));
  }

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

        // Re-fetch to read first_seen_at (upsert preserves it for returning visitors)
        const visitorRow = visitors.findById(msg.visitorId);
        const REPEAT_VISITOR_THRESHOLD_MS = 24 * 60 * 60 * 1000;
        const isReturning = !!(visitorRow && (now - visitorRow.first_seen_at) >= REPEAT_VISITOR_THRESHOLD_MS);

        const ip = ipRaw || null;
        const geo = lookup(ip);
        const ua = new UAParser(msg.userAgent ?? '').getResult();
        const device_type = ua.device.type ?? 'desktop';
        const browser = ua.browser.name ?? null;
        const os = ua.os.name ?? null;

        // hello is idempotent: a widget WS that reconnects within the same browser
        // tab reuses its sessionId. Skip session/page_view/auto-signal inserts on
        // reconnect so we don't crash on UNIQUE(sessions.id) and don't double-count.
        const existingSession = sessions.findById(msg.sessionId);
        if (!existingSession) {
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
            ip,
            city: geo.city, region: geo.region, country: geo.country, timezone: geo.timezone,
            device_type, browser, os,
          });
          new PageViewsRepo(deps.db).enter(msg.sessionId, msg.page.url, msg.page.title, now);
        }
        deps.ls.add(msg.visitorId, msg.sessionId, ws, { url: msg.page.url, title: msg.page.title, enteredAt: now });

        // Auto-derived lead signals — only on first hello for this session.
        const lsRepo = new LeadSignalsRepo(deps.db);
        let totalDelta = 0;

        function autoSignal(kind: string, payload: unknown = null) {
          const delta = scoreFor(kind);
          lsRepo.insert(msg.sessionId, kind, payload, delta, now);
          totalDelta += delta;
        }

        if (!existingSession) {
          if (isReturning) autoSignal('returning_visitor');
          if (msg.utms.gclid) autoSignal('google_ads_click', { gclid: msg.utms.gclid });
          const url = msg.page.url.toLowerCase();
          if (url.includes('/pricing') || url.includes('/lp/start-your-1031')) autoSignal('pricing_page_view');
        }

        if (totalDelta > 0) {
          sessions.bumpLeadScore(msg.sessionId, totalDelta);
          const cur = sessions.findById(msg.sessionId)?.current_lead_score ?? 0;
          deps.ls.patch(msg.visitorId, { leadScore: cur });
          deps.oc.broadcastTo(1, { type: 'visitor_updated', visitorId: msg.visitorId, patch: { leadScore: cur } });
          if (cur >= 8) {
            deps.oc.broadcastTo(1, { type: 'high_priority_alert', visitorId: msg.visitorId, reason: 'lead_score_8' });
          }
        }

        // Warm-visitor alert: start the dwell timer if this session is already
        // showing buying intent (score > 0) and there's no open conversation.
        const currentScore = sessions.findById(msg.sessionId)?.current_lead_score ?? 0;
        const cutoffWarm = now - 30 * 24 * 60 * 60 * 1000;
        const existingConvForWarm = conversations.findOpenForVisitor(msg.visitorId, cutoffWarm);
        if (currentScore > 0 && !existingConvForWarm) {
          deps.warmTimers.start(msg.visitorId, msg.sessionId, dwellMsForEnv(), () => {
            fireWarmVisitorAlert(msg.visitorId, msg.sessionId, msg.page.url);
          });
        }

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

        // Broadcast to operator console: visitor appeared
        const visitor = visitors.findById(msg.visitorId);
        const session = sessions.findById(msg.sessionId);
        deps.oc.broadcastTo(1, { type: 'visitor_appeared', visitor, session });
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
            // Broadcast to operator console: visitor changed page
            deps.oc.broadcastTo(1, {
              type: 'visitor_updated',
              visitorId: state.visitorId,
              patch: { currentPage: { url: msg.page.url, title: msg.page.title, enteredAt: now } },
            });
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
          const prevScore = sessions.findById(state.sessionId)?.current_lead_score ?? 0;
          new SessionsRepo(deps.db).bumpLeadScore(state.sessionId, delta);
          const cur = (sessions.findById(state.sessionId)?.current_lead_score ?? 0);
          deps.ls.patch(state.visitorId, { leadScore: cur });
          // Broadcast to operator console: lead score updated
          deps.oc.broadcastTo(1, {
            type: 'visitor_updated',
            visitorId: state.visitorId,
            patch: { leadScore: cur },
          });
          // Warm-visitor alert: start dwell timer when score newly becomes positive.
          if (prevScore === 0 && cur > 0) {
            const cutoffWarm = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const existingConvForWarm = conversations.findOpenForVisitor(state.visitorId, cutoffWarm);
            if (!existingConvForWarm) {
              const currentUrlForWarm = deps.ls.get(state.visitorId)?.currentPage.url ?? '';
              const sId = state.sessionId;
              const vId = state.visitorId;
              deps.warmTimers.start(vId, sId, dwellMsForEnv(), () => {
                fireWarmVisitorAlert(vId, sId, currentUrlForWarm);
              });
            }
          }
          // High-priority alert when crossing the 8 threshold
          if (prevScore < 8 && cur >= 8) {
            deps.oc.broadcastTo(1, {
              type: 'high_priority_alert',
              visitorId: state.visitorId,
              reason: 'lead_score_8',
            });
          }
        }
        break;
      }
      case 'chat_open': {
        if (!state.visitorId) break;
        // Idempotent: only create if no open conversation exists
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const existing = conversations.findOpenForVisitor(state.visitorId, cutoff);
        if (existing) {
          deps.ls.patch(state.visitorId, { conversationId: existing.id });
        }
        deps.warmTimers.cancel(state.visitorId);
        break;
      }

      case 'chat_message': {
        if (!state.visitorId || !state.sessionId) break;
        deps.warmTimers.cancel(state.visitorId);
        const now = Date.now();
        const op = operators.findById(1);
        const initialStatus: 'live' | 'queued' = (op?.status === 'online') ? 'live' : 'queued';
        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        let conv = conversations.findOpenForVisitor(state.visitorId, cutoff);
        const isNewConversation = !conv;
        if (!conv) {
          const cid = newConversationId();
          conversations.create({
            id: cid, visitor_id: state.visitorId,
            opened_session_id: state.sessionId,
            status: initialStatus, opened_at: now, initiated_by: 'visitor',
          });
          conv = conversations.findById(cid)!;
          deps.ls.patch(state.visitorId, { conversationId: cid });
        }
        const messagesRepo = new MessagesRepo(deps.db);
        const msgRow = messagesRepo.insert({ conversation_id: conv.id, sender: 'visitor', body: msg.body, sent_at: now });
        conversations.bumpLastMessageAt(conv.id, now);
        // Echo back nothing to visitor (their UI already shows it locally).
        // Operator-side dispatch happens in Phase 4.
        logger.debug({ msgId: msgRow.id, conv: conv.id }, 'visitor chat_message stored');
        // Broadcast to operator console: new conversation row (for both queued and live).
        // Must precede `new_message` so the reducer can attach the message to a known conv.
        if (isNewConversation) {
          deps.oc.broadcastTo(1, { type: 'conversation_added', conversation: conv });
          if (initialStatus === 'queued') {
            // Backwards compat: existing test expects this for queued.
            deps.oc.broadcastTo(1, { type: 'conversation_queued', conversation: conv });
          }
        }
        deps.oc.broadcastTo(1, { type: 'new_message', conversationId: conv.id, message: msgRow });
        // Web Push notify operator if they are unavailable (offline/away/dnd/no-ws/quiet-hours).
        const hasLiveOp = deps.oc.hasAnyConnection(1);
        if (shouldPushOperator(op ?? undefined, hasLiveOp)) {
          pushDispatcher
            .pushToOperator(deps, 1, {
              title: 'New message from visitor',
              body: msg.body.slice(0, 100),
              url: `/console/#/chat/${conv.id}`,
            })
            .catch((err) => logger.warn({ err }, 'push trigger failed'));
        }
        // Start Phase-2 capture timer for new queued conversations (operator offline).
        if (isNewConversation && initialStatus === 'queued') {
          deps.timers.start(conv.id, () => {
            const live = deps.ls.get(state.visitorId!);
            if (!live) return;
            const v = visitors.findById(state.visitorId!);
            const skipForm = !!(v?.email && v.email.length > 0);
            const payload = JSON.stringify({
              type: 'phase_transition',
              phase: skipForm ? 'email_on_file' : 'capture',
              knownEmail: v?.email ?? null,
            });
            for (const sock of live.sockets) {
              try { sock.send(payload); } catch {}
            }
          });
        }
        break;
      }

      case 'typing': {
        if (!state.visitorId) break;
        deps.ls.patch(state.visitorId, { isTyping: msg.isTyping });
        // Broadcast to operator console: visitor typing (only if there's an active conversation)
        const live = deps.ls.get(state.visitorId);
        if (live?.conversationId) {
          deps.oc.broadcastTo(1, { type: 'visitor_typing', conversationId: live.conversationId, isTyping: msg.isTyping });
        }
        break;
      }

      case 'capture': {
        if (!state.visitorId) break;
        visitors.updateContact(state.visitorId, { name: msg.name, email: msg.email, phone: msg.phone });
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const conv = conversations.findOpenForVisitor(state.visitorId, cutoff);
        if (conv) {
          conversations.setTimeoutCapture(conv.id, { name: msg.name, email: msg.email, phone: msg.phone });
          conversations.setStatus(conv.id, 'closed_for_followup', Date.now());
          deps.timers.cancel(conv.id);
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (state.visitorId) {
      deps.warmTimers.cancel(state.visitorId);
      if (state.sessionId) deps.warmTimers.clearForSession(state.sessionId);
      deps.ls.remove(state.visitorId, ws);
      logger.debug({ visitorId: state.visitorId }, 'visitor ws closed');
      // Broadcast to operator console: visitor disconnected (immediately, no grace period for v1)
      deps.oc.broadcastTo(1, { type: 'visitor_left', visitorId: state.visitorId });
    }
  });
}
