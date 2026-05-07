import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';
import { MiddlePane } from '../../src/panels/MiddlePane.js';
import { selectedVisitorId, selectedConversationId, liveVisitors, leftVisitors, closedConversations } from '../../src/state/store.js';

beforeEach(() => {
  selectedVisitorId.value = null;
  selectedConversationId.value = null;
  liveVisitors.value = {};
  leftVisitors.value = {};
  closedConversations.value = {};
  cleanup();
});

describe('MiddlePane history view', () => {
  it('renders prior messages when visitor has a closed conversation', () => {
    const visitorId = 'v_abc123def456';
    leftVisitors.value = {
      [visitorId]: {
        visitorId, name: 'Sam', leadScore: 5, isHot: false,
        currentPage: { url: 'https://simple1031x.com/', title: 'Home', enteredAt: 0 },
        scrollPct: 0, isTyping: false, leftAt: Date.now(),
        activeSessionId: 's1', lastSeenAt: Date.now(), socketCount: 0,
      } as any,
    };
    closedConversations.value = {
      'c_xyz': {
        id: 'c_xyz', visitor_id: visitorId, opened_session_id: 's1', status: 'closed',
        opened_at: 1000, closed_at: 2000, last_message_at: 2000, initiated_by: 'visitor',
        timeout_capture: null,
        lastMessages: [
          { id: 1, conversation_id: 'c_xyz', sender: 'visitor', body: 'hello there', sent_at: 1500, seen_at: null, quick_reply_id: null },
          { id: 2, conversation_id: 'c_xyz', sender: 'operator', body: 'hi back', sent_at: 1800, seen_at: 2000, quick_reply_id: null },
        ],
        last_message_preview: 'hi back',
      } as any,
    };
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    expect(screen.getByText('hello there')).toBeTruthy();
    expect(screen.getByText('hi back')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start new chat/i })).toBeTruthy();
  });

  it('shows live preview card when visitor is live with no conversation', () => {
    const visitorId = 'v_live123def789';
    liveVisitors.value = {
      [visitorId]: {
        visitorId, name: null, leadScore: 7, isHot: false,
        currentPage: { url: 'https://simple1031x.com/tax-calculator', title: 'Calc', enteredAt: 0 },
        scrollPct: 60, isTyping: false,
        activeSessionId: 's2', lastSeenAt: Date.now(), socketCount: 1,
      } as any,
    };
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    expect(screen.getByText(/Lead Score/i)).toBeTruthy();
    expect(screen.queryByText(/Closed at/i)).toBeNull();
  });
});
