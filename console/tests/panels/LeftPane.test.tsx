import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { LeftPane } from '../../src/panels/LeftPane.js';
import { liveVisitors, leftVisitors, closedConversations, conversations } from '../../src/state/store.js';

beforeEach(() => {
  liveVisitors.value = {};
  leftVisitors.value = {};
  closedConversations.value = {};
  conversations.value = {};
  cleanup();
});

describe('LeftPane Left tab', () => {
  it('shows visitors from closedConversations on Left tab', () => {
    closedConversations.value = {
      'c1': {
        id: 'c1', visitor_id: 'v_xyz', last_message_at: Date.now() - 1000, closed_at: Date.now(),
        status: 'closed', opened_at: 0, opened_session_id: null, initiated_by: 'visitor',
        timeout_capture: null, lastMessages: [], last_message_preview: 'see you',
      } as any,
    };
    render(<LeftPane />);
    // Click "Left" tab
    const leftTab = screen.getByText(/^Left \(/i);
    fireEvent.click(leftTab);
    expect(screen.getByText('see you')).toBeTruthy();
  });

  it('deduplicates: session-leaver beats closed conversation for same visitorId', () => {
    const visitorId = 'v_dedup123456';
    leftVisitors.value = {
      [visitorId]: {
        visitorId, name: 'Jane', leadScore: 3, isHot: false,
        currentPage: { url: 'https://simple1031x.com/', title: 'Home', enteredAt: 0 },
        scrollPct: 0, isTyping: false, leftAt: Date.now(),
        activeSessionId: 's1', lastSeenAt: Date.now(), socketCount: 0,
      } as any,
    };
    closedConversations.value = {
      'c2': {
        id: 'c2', visitor_id: visitorId, last_message_at: Date.now() - 5000, closed_at: Date.now() - 4000,
        status: 'closed', opened_at: 0, opened_session_id: null, initiated_by: 'visitor',
        timeout_capture: null, lastMessages: [], last_message_preview: 'from closed',
      } as any,
    };
    render(<LeftPane />);
    const leftTab = screen.getByText(/^Left \(/i);
    fireEvent.click(leftTab);
    // Should show exactly one row (deduplicated), named Jane (session entry wins)
    expect(screen.getByText('Jane')).toBeTruthy();
    // The preview text from the closed conversation should NOT appear (session entry was used)
    expect(screen.queryByText('from closed')).toBeNull();
  });

  it('shows both entries when visitorIds differ', () => {
    leftVisitors.value = {
      'v_session001': {
        visitorId: 'v_session001', name: 'Alice', leadScore: 2, isHot: false,
        currentPage: { url: 'https://simple1031x.com/', title: 'Home', enteredAt: 0 },
        scrollPct: 0, isTyping: false, leftAt: Date.now(),
        activeSessionId: 's1', lastSeenAt: Date.now(), socketCount: 0,
      } as any,
    };
    closedConversations.value = {
      'c3': {
        id: 'c3', visitor_id: 'v_other999', last_message_at: Date.now() - 2000, closed_at: Date.now() - 1000,
        status: 'closed', opened_at: 0, opened_session_id: null, initiated_by: 'visitor',
        timeout_capture: null, lastMessages: [], last_message_preview: 'goodbye',
      } as any,
    };
    render(<LeftPane />);
    const leftTab = screen.getByText(/^Left \(/i);
    fireEvent.click(leftTab);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('goodbye')).toBeTruthy();
  });

  it('shows empty state when both sources are empty', () => {
    render(<LeftPane />);
    const leftTab = screen.getByText(/^Left \(/i);
    fireEvent.click(leftTab);
    expect(screen.getByText('No recent visitors')).toBeTruthy();
  });
});

describe('LeftPane tab counts — stale conversation filtering', () => {
  function makeConv(id: string, visitorId: string, status: 'live' | 'queued') {
    return {
      id, visitor_id: visitorId, status,
      opened_at: Date.now() - 5000, closed_at: null,
      last_message_at: Date.now() - 5000,
      opened_session_id: null, initiated_by: 'visitor' as const,
      timeout_capture: null, messages: [],
    };
  }

  function makeLiveVisitor(visitorId: string) {
    return {
      visitorId, name: null, leadScore: 0, isHot: false,
      currentPage: { url: '/', title: null, enteredAt: 0 },
      scrollPct: 0, isTyping: false,
      activeSessionId: 's1', lastSeenAt: Date.now(), socketCount: 1,
    };
  }

  it('Live tab count matches only conversations whose visitor is in liveVisitors', () => {
    // 2 live conversations, only 1 visitor actually connected
    conversations.value = {
      'c_real': makeConv('c_real', 'v_real123456', 'live'),
      'c_stale': makeConv('c_stale', 'v_stale12345', 'live'),
    };
    liveVisitors.value = {
      'v_real123456': makeLiveVisitor('v_real123456') as any,
    };
    render(<LeftPane />);
    // Tab should read "Live (1)" not "Live (2)"
    expect(screen.getByText(/^Live \(1\)$/i)).toBeTruthy();
  });

  it('Waiting tab count only counts conversations with a live visitor', () => {
    conversations.value = {
      'c_q1': makeConv('c_q1', 'v_q1_1234567', 'queued'),
      'c_q2': makeConv('c_q2', 'v_q2_1234567', 'queued'),
      'c_q3': makeConv('c_q3', 'v_q3_1234567', 'queued'),
    };
    liveVisitors.value = {
      'v_q1_1234567': makeLiveVisitor('v_q1_1234567') as any,
    };
    render(<LeftPane />);
    expect(screen.getByText(/^Waiting \(1\)$/i)).toBeTruthy();
  });

  it('On Site count excludes visitors already in an active conversation', () => {
    // 2 live visitors, 1 has a live conversation → On Site should be 1
    conversations.value = {
      'c_live': makeConv('c_live', 'v_inchat12345', 'live'),
    };
    liveVisitors.value = {
      'v_inchat12345': makeLiveVisitor('v_inchat12345') as any,
      'v_onsite12345': makeLiveVisitor('v_onsite12345') as any,
    };
    render(<LeftPane />);
    expect(screen.getByText(/^On Site \(1\)$/i)).toBeTruthy();
  });
});
