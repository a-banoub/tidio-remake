import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { MiddlePane } from '../../src/panels/MiddlePane.js';
import { selectedVisitorId, selectedConversationId, liveVisitors, leftVisitors, closedConversations, conversations } from '../../src/state/store.js';
import * as wsBoot from '../../src/wsBoot.js';

let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  selectedVisitorId.value = null;
  selectedConversationId.value = null;
  liveVisitors.value = {};
  leftVisitors.value = {};
  closedConversations.value = {};
  conversations.value = {};
  send = vi.fn();
  vi.spyOn(wsBoot, 'getWs').mockReturnValue({ send } as any);
  cleanup();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function makeClosedVisitorSetup(visitorId: string) {
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
}

describe('MiddlePane history view', () => {
  it('renders prior messages when visitor has a closed conversation', () => {
    const visitorId = 'v_abc123def456';
    makeClosedVisitorSetup(visitorId);
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    expect(screen.getByText('hello there')).toBeTruthy();
    expect(screen.getByText('hi back')).toBeTruthy();
    // Inline composer replaces the old modal button
    expect(screen.getByPlaceholderText('Start a new chat…')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Send$/i })).toBeTruthy();
    // The old modal-trigger button should be gone
    expect(screen.queryByRole('button', { name: /Start new chat/i })).toBeNull();
  });

  it('Send button is disabled when textarea is empty', () => {
    const visitorId = 'v_abc123def456';
    makeClosedVisitorSetup(visitorId);
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    const sendBtn = screen.getByRole('button', { name: /^Send$/i }) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });

  it('typing in textarea enables Send button', () => {
    const visitorId = 'v_abc123def456';
    makeClosedVisitorSetup(visitorId);
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    const textarea = screen.getByPlaceholderText('Start a new chat…') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Hello!' } });
    const sendBtn = screen.getByRole('button', { name: /^Send$/i }) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
  });

  it('clicking Send dispatches open_chat then send_message after conversation appears', async () => {
    vi.useFakeTimers();
    const visitorId = 'v_abc123def456';
    makeClosedVisitorSetup(visitorId);
    selectedVisitorId.value = visitorId;

    render(<MiddlePane />);
    const textarea = screen.getByPlaceholderText('Start a new chat…') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Hi there!' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    // open_chat fires immediately
    expect(send).toHaveBeenCalledWith({ type: 'open_chat', visitorId });

    // Simulate server pushing the new conversation into state
    conversations.value = {
      'c_new': {
        id: 'c_new', visitor_id: visitorId, status: 'live',
        opened_at: Date.now(), closed_at: null, last_message_at: Date.now(),
        opened_session_id: null, initiated_by: 'operator', timeout_capture: null, messages: [],
      } as any,
    };

    // Advance timers to let polling interval fire
    await vi.runAllTimersAsync();

    expect(send).toHaveBeenCalledWith({ type: 'send_message', conversationId: 'c_new', body: 'Hi there!' });
    vi.useRealTimers();
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
