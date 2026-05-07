import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { LeftPane } from '../../src/panels/LeftPane.js';
import { liveVisitors, leftVisitors, closedConversations } from '../../src/state/store.js';

beforeEach(() => {
  liveVisitors.value = {};
  leftVisitors.value = {};
  closedConversations.value = {};
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
