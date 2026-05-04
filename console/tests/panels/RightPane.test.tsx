import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { RightPane } from '../../src/panels/RightPane.js';
import {
  liveVisitors,
  conversations,
  selectedConversationId,
} from '../../src/state/store.js';
import { visitorDetail } from '../../src/state/visitorDetail.js';

beforeEach(() => {
  liveVisitors.value = {};
  conversations.value = {};
  selectedConversationId.value = null;
  visitorDetail.value = null;
  cleanup();
});

function setupVisitor() {
  liveVisitors.value = {
    v_abc: {
      visitorId: 'v_abc',
      activeSessionId: 's_1',
      lastSeenAt: 1,
      currentPage: { url: '/x', title: null, enteredAt: 1 },
      scrollPct: 0,
      leadScore: 0,
      isHot: false,
      isTyping: false,
      socketCount: 1,
    },
  };
  conversations.value = {
    c_1: {
      id: 'c_1',
      visitor_id: 'v_abc',
      opened_session_id: null,
      status: 'live',
      opened_at: 1,
      closed_at: null,
      last_message_at: 1,
      initiated_by: 'visitor',
      timeout_capture: null,
      messages: [],
    },
  };
  selectedConversationId.value = 'c_1';
}

describe('RightPane returning badge', () => {
  it('hides badge when visitCount is 1', () => {
    setupVisitor();
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [],
      leadSignals: [],
      recentConversations: [],
      visitCount: 1,
    };
    const { queryByText } = render(<RightPane />);
    expect(queryByText(/RETURNING/i)).toBeNull();
  });

  it('shows 3rd visit badge for visitCount=3', () => {
    setupVisitor();
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [],
      leadSignals: [],
      recentConversations: [],
      visitCount: 3,
    };
    const { getByText } = render(<RightPane />);
    expect(getByText(/3rd/i)).toBeTruthy();
    expect(getByText(/RETURNING/i)).toBeTruthy();
  });

  it('uses 2nd ordinal', () => {
    setupVisitor();
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [],
      leadSignals: [],
      recentConversations: [],
      visitCount: 2,
    };
    const { getByText } = render(<RightPane />);
    expect(getByText(/2nd/i)).toBeTruthy();
  });
});
