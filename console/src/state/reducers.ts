import { liveVisitors, leftVisitors, conversations, operatorStatus, pendingAlerts, unreadByConversation, selectedConversationId } from './store.js';
import type { LiveVisitor, Conversation, Message } from './types.js';
import { notifyVisitorMessage } from '../notifications.js';

export function applyWsMessage(msg: any): void {
  switch (msg?.type) {
    case 'state_snapshot': {
      const lv: Record<string, LiveVisitor> = {};
      for (const v of msg.liveVisitors ?? []) lv[v.visitorId] = v;
      liveVisitors.value = lv;
      const conv: Record<string, Conversation> = {};
      for (const c of [...(msg.openConversations ?? []), ...(msg.queuedConversations ?? [])]) {
        conv[c.id] = { ...c, messages: c.lastMessages ?? [] };
      }
      conversations.value = conv;
      break;
    }
    case 'visitor_appeared': {
      const v = msg.visitor;
      const s = msg.session;
      // Compose a LiveVisitor stub. The server's `visitor_appeared` payload sends row-shape
      // visitor + session; we adapt to the LiveVisitor shape using session info as defaults.
      liveVisitors.value = {
        ...liveVisitors.value,
        [v.id]: {
          visitorId: v.id,
          activeSessionId: s?.id ?? '',
          lastSeenAt: Date.now(),
          currentPage: { url: s?.landing_url ?? '', title: null, enteredAt: s?.started_at ?? Date.now() },
          scrollPct: 0,
          leadScore: s?.current_lead_score ?? 0,
          isHot: (s?.current_lead_score ?? 0) >= 8,
          isTyping: false,
          socketCount: 1,
          name: v.name ?? undefined,
          email: v.email ?? undefined,
          phone: v.phone ?? undefined,
        },
      };
      break;
    }
    case 'visitor_updated': {
      const cur = liveVisitors.value[msg.visitorId];
      if (!cur) return;
      const next: LiveVisitor = { ...cur, ...msg.patch, lastSeenAt: Date.now() };
      if (typeof next.leadScore === 'number') next.isHot = next.leadScore >= 8;
      liveVisitors.value = { ...liveVisitors.value, [msg.visitorId]: next };
      break;
    }
    case 'visitor_left': {
      const v = liveVisitors.value[msg.visitorId];
      if (v) {
        // Archive to leftVisitors with timestamp
        leftVisitors.value = { ...leftVisitors.value, [msg.visitorId]: { ...v, leftAt: Date.now() } };
      }
      const next = { ...liveVisitors.value };
      delete next[msg.visitorId];
      liveVisitors.value = next;
      break;
    }
    case 'visitor_typing': {
      // Mark visitor as typing if found
      const cid = msg.conversationId;
      const conv = conversations.value[cid];
      if (!conv) return;
      const cur = liveVisitors.value[conv.visitor_id];
      if (cur) liveVisitors.value = { ...liveVisitors.value, [conv.visitor_id]: { ...cur, isTyping: !!msg.isTyping } };
      break;
    }
    case 'new_message': {
      const cid = msg.conversationId;
      const m = msg.message as Message;
      const conv = conversations.value[cid];
      if (conv) {
        conversations.value = { ...conversations.value, [cid]: { ...conv, messages: [...conv.messages, m], last_message_at: m.sent_at } };
      }
      if (m.sender === 'visitor') {
        const visitor = conv ? liveVisitors.value[conv.visitor_id] : undefined;
        notifyVisitorMessage({ name: visitor?.name ?? null, body: m.body });
        // Bump unread count when the message is for a conversation the
        // operator isn't currently looking at — drives the left-rail badge.
        if (selectedConversationId.value !== cid) {
          unreadByConversation.value = {
            ...unreadByConversation.value,
            [cid]: (unreadByConversation.value[cid] ?? 0) + 1,
          };
        }
      }
      break;
    }
    case 'conversation_added':
    case 'conversation_queued': {
      const c = msg.conversation as Conversation;
      const existing = conversations.value[c.id];
      conversations.value = {
        ...conversations.value,
        [c.id]: { ...c, messages: existing?.messages ?? [] },
      };
      break;
    }
    case 'conversation_closed': {
      const cur = conversations.value[msg.conversationId];
      if (!cur) return;
      conversations.value = { ...conversations.value, [msg.conversationId]: { ...cur, status: 'closed', closed_at: Date.now() } };
      break;
    }
    case 'high_priority_alert': {
      pendingAlerts.value = [...pendingAlerts.value, { visitorId: msg.visitorId, reason: msg.reason, timestamp: Date.now() }];
      break;
    }
    case 'warm_visitor_alert': {
      pendingAlerts.value = [
        ...pendingAlerts.value,
        { visitorId: msg.visitorId, reason: 'warm_visitor', timestamp: Date.now() },
      ];
      break;
    }
    case 'status_changed': {
      operatorStatus.value = msg.status;
      break;
    }
    case 'conversation_opened': {
      // No-op here; the PingModal handles the conversationId discovery via the conversations signal.
      // The actual conversation row will arrive via a subsequent state_snapshot or new_message.
      break;
    }
  }
}
