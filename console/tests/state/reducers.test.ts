import { describe, it, expect, beforeEach, vi } from 'vitest';
import { liveVisitors, conversations, queuedConversations, liveConversations, pendingAlerts, operatorStatus, unreadByConversation, selectedConversationId, closedConversations } from '../../src/state/store.js';
import { applyWsMessage } from '../../src/state/reducers.js';
import * as notifications from '../../src/notifications.js';

beforeEach(() => {
  liveVisitors.value = {};
  conversations.value = {};
  pendingAlerts.value = [];
  operatorStatus.value = 'online';
  unreadByConversation.value = {};
  selectedConversationId.value = null;
  closedConversations.value = {};
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

  it('warm_visitor_alert appends an entry to pendingAlerts with reason "warm_visitor"', () => {
    pendingAlerts.value = [];
    applyWsMessage({
      type: 'warm_visitor_alert',
      visitorId: 'v_warm12345678',
      sessionId: 's_xyz123456789',
      leadScore: 4,
      page: 'https://simple1031x.com/pricing',
      dwellMs: 90_000,
      reason: 'warm_dwell_90s',
    });
    expect(pendingAlerts.value).toHaveLength(1);
    expect(pendingAlerts.value[0]).toMatchObject({
      visitorId: 'v_warm12345678',
      reason: 'warm_visitor',
    });
  });

  it('warm_visitor_alert does not clobber existing alerts', () => {
    pendingAlerts.value = [{ visitorId: 'v_old', reason: 'lead_score_8', timestamp: 1 }];
    applyWsMessage({
      type: 'warm_visitor_alert',
      visitorId: 'v_new12345678',
      sessionId: 's_z',
      leadScore: 3,
      page: '/x',
      dwellMs: 90_000,
      reason: 'warm_dwell_90s',
    });
    expect(pendingAlerts.value).toHaveLength(2);
    expect(pendingAlerts.value[0].visitorId).toBe('v_old');
    expect(pendingAlerts.value[1].visitorId).toBe('v_new12345678');
  });

  it('status_changed updates operatorStatus signal', () => {
    applyWsMessage({ type: 'status_changed', status: 'away' });
    expect(operatorStatus.value).toBe('away');
  });
});

describe('state_snapshot recentlyClosedConversations hydration', () => {
  beforeEach(() => { closedConversations.value = {}; });

  it('populates closedConversations signal from snapshot', () => {
    applyWsMessage({
      type: 'state_snapshot',
      liveVisitors: [], openConversations: [], queuedConversations: [],
      recentlyClosedConversations: [
        { id: 'c1', visitor_id: 'v1', opened_session_id: 's1', status: 'closed',
          opened_at: 1000, closed_at: 2000, last_message_at: 2000,
          initiated_by: 'visitor', timeout_capture: null,
          lastMessages: [{ id: 1, conversation_id: 'c1', sender: 'visitor', body: 'hi', sent_at: 1500, seen_at: null, quick_reply_id: null }],
          last_message_preview: 'hi' },
      ],
    });
    expect(Object.keys(closedConversations.value)).toEqual(['c1']);
    expect(closedConversations.value['c1'].last_message_preview).toBe('hi');
  });

  it('appends on conversation_closed event', () => {
    closedConversations.value = {};
    applyWsMessage({
      type: 'conversation_closed',
      conversation: {
        id: 'c2', visitor_id: 'v2', opened_session_id: 's2', status: 'closed',
        opened_at: 3000, closed_at: 4000, last_message_at: 4000,
        initiated_by: 'operator', timeout_capture: null,
        lastMessages: [], last_message_preview: null,
      },
    });
    expect(closedConversations.value['c2']).toBeDefined();
  });
});
