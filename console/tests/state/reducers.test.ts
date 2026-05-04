import { describe, it, expect, beforeEach, vi } from 'vitest';
import { liveVisitors, conversations, queuedConversations, liveConversations, pendingAlerts, operatorStatus, unreadByConversation, selectedConversationId } from '../../src/state/store.js';
import { applyWsMessage } from '../../src/state/reducers.js';
import * as notifications from '../../src/notifications.js';

beforeEach(() => {
  liveVisitors.value = {};
  conversations.value = {};
  pendingAlerts.value = [];
  operatorStatus.value = 'online';
  unreadByConversation.value = {};
  selectedConversationId.value = null;
});

describe('reducers', () => {
  it('state_snapshot populates everything', () => {
    applyWsMessage({
      type: 'state_snapshot',
      liveVisitors: [{ visitorId: 'v_a', activeSessionId: 's_1', lastSeenAt: 1, currentPage: { url: '/x', title: 'X', enteredAt: 1 }, scrollPct: 0, leadScore: 0, isHot: false, isTyping: false, socketCount: 1 }],
      openConversations: [{ id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, lastMessages: [] }],
      queuedConversations: [{ id: 'c_b', visitor_id: 'v_b', opened_session_id: null, status: 'queued', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, lastMessages: [] }],
    });
    expect(Object.keys(liveVisitors.value)).toContain('v_a');
    expect(liveConversations.value).toHaveLength(1);
    expect(queuedConversations.value).toHaveLength(1);
  });

  it('visitor_appeared adds to liveVisitors', () => {
    applyWsMessage({
      type: 'visitor_appeared',
      visitor: { id: 'v_a' },
      session: { id: 's_1', landing_url: '/x', started_at: 1, current_lead_score: 0 },
    });
    expect(liveVisitors.value['v_a']).toBeDefined();
  });

  it('visitor_updated patches leadScore + recomputes isHot', () => {
    liveVisitors.value = {
      v_a: { visitorId: 'v_a', activeSessionId: 's_1', lastSeenAt: 1, currentPage: { url: '/x', title: null, enteredAt: 1 }, scrollPct: 0, leadScore: 0, isHot: false, isTyping: false, socketCount: 1 },
    };
    applyWsMessage({ type: 'visitor_updated', visitorId: 'v_a', patch: { leadScore: 9 } });
    expect(liveVisitors.value['v_a'].leadScore).toBe(9);
    expect(liveVisitors.value['v_a'].isHot).toBe(true);
  });

  it('visitor_left removes visitor', () => {
    liveVisitors.value = {
      v_a: { visitorId: 'v_a', activeSessionId: 's_1', lastSeenAt: 1, currentPage: { url: '/x', title: null, enteredAt: 1 }, scrollPct: 0, leadScore: 0, isHot: false, isTyping: false, socketCount: 1 },
    };
    applyWsMessage({ type: 'visitor_left', visitorId: 'v_a' });
    expect(liveVisitors.value['v_a']).toBeUndefined();
  });

  it('new_message appends to conversation messages', () => {
    conversations.value = {
      c_a: { id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, messages: [] },
    };
    applyWsMessage({ type: 'new_message', conversationId: 'c_a', message: { id: 1, conversation_id: 'c_a', sender: 'visitor', body: 'hi', sent_at: 100, seen_at: null, quick_reply_id: null } });
    expect(conversations.value['c_a'].messages).toHaveLength(1);
    expect(conversations.value['c_a'].messages[0].body).toBe('hi');
  });

  it('new_message from visitor calls notifyVisitorMessage with visitor name', () => {
    const spy = vi.spyOn(notifications, 'notifyVisitorMessage').mockImplementation(() => {});
    liveVisitors.value = {
      v_a: { visitorId: 'v_a', activeSessionId: 's_1', lastSeenAt: 1, currentPage: { url: '/x', title: null, enteredAt: 1 }, scrollPct: 0, leadScore: 0, isHot: false, isTyping: false, socketCount: 1, name: 'Pat' },
    };
    conversations.value = {
      c_a: { id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, messages: [] },
    };
    applyWsMessage({ type: 'new_message', conversationId: 'c_a', message: { id: 1, conversation_id: 'c_a', sender: 'visitor', body: 'hello', sent_at: 100, seen_at: null, quick_reply_id: null } });
    expect(spy).toHaveBeenCalledWith({ name: 'Pat', body: 'hello' });
    spy.mockRestore();
  });

  it('new_message from visitor increments unread when conversation NOT selected', () => {
    vi.spyOn(notifications, 'notifyVisitorMessage').mockImplementation(() => {});
    conversations.value = {
      c_a: { id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, messages: [] },
    };
    selectedConversationId.value = null; // nothing selected
    applyWsMessage({ type: 'new_message', conversationId: 'c_a', message: { id: 1, conversation_id: 'c_a', sender: 'visitor', body: 'hi', sent_at: 100, seen_at: null, quick_reply_id: null } });
    expect(unreadByConversation.value['c_a']).toBe(1);
    applyWsMessage({ type: 'new_message', conversationId: 'c_a', message: { id: 2, conversation_id: 'c_a', sender: 'visitor', body: 'still here?', sent_at: 200, seen_at: null, quick_reply_id: null } });
    expect(unreadByConversation.value['c_a']).toBe(2);
  });

  it('new_message from visitor does NOT increment unread when that conversation IS selected', () => {
    vi.spyOn(notifications, 'notifyVisitorMessage').mockImplementation(() => {});
    conversations.value = {
      c_a: { id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, messages: [] },
    };
    selectedConversationId.value = 'c_a';
    applyWsMessage({ type: 'new_message', conversationId: 'c_a', message: { id: 1, conversation_id: 'c_a', sender: 'visitor', body: 'hi', sent_at: 100, seen_at: null, quick_reply_id: null } });
    expect(unreadByConversation.value['c_a']).toBeUndefined();
  });

  it('new_message from operator does NOT trigger notification', () => {
    const spy = vi.spyOn(notifications, 'notifyVisitorMessage').mockImplementation(() => {});
    conversations.value = {
      c_a: { id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, messages: [] },
    };
    applyWsMessage({ type: 'new_message', conversationId: 'c_a', message: { id: 2, conversation_id: 'c_a', sender: 'operator', body: 'reply', sent_at: 200, seen_at: null, quick_reply_id: null } });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('conversation_queued adds new queued conversation', () => {
    applyWsMessage({
      type: 'conversation_queued',
      conversation: { id: 'c_q', visitor_id: 'v_x', opened_session_id: null, status: 'queued', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null },
    });
    expect(queuedConversations.value).toHaveLength(1);
  });

  it('conversation_closed marks conversation closed', () => {
    conversations.value = {
      c_a: { id: 'c_a', visitor_id: 'v_a', opened_session_id: null, status: 'live', opened_at: 1, closed_at: null, last_message_at: 1, initiated_by: 'visitor', timeout_capture: null, messages: [] },
    };
    applyWsMessage({ type: 'conversation_closed', conversationId: 'c_a' });
    expect(conversations.value['c_a'].status).toBe('closed');
  });

  it('high_priority_alert appends to pendingAlerts', () => {
    applyWsMessage({ type: 'high_priority_alert', visitorId: 'v_a', reason: 'lead_score_8' });
    expect(pendingAlerts.value).toHaveLength(1);
    expect(pendingAlerts.value[0].visitorId).toBe('v_a');
  });

  it('status_changed updates operatorStatus signal', () => {
    applyWsMessage({ type: 'status_changed', status: 'away' });
    expect(operatorStatus.value).toBe('away');
  });
});
