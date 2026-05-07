import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { Toast } from '../../src/components/Toast.js';
import {
  pendingAlerts, pendingPing, liveVisitors, conversations, selectedConversationId,
} from '../../src/state/store.js';

beforeEach(() => {
  pendingAlerts.value = [];
  pendingPing.value = null;
  liveVisitors.value = {};
  conversations.value = {};
  selectedConversationId.value = null;
  cleanup();
});

function makeVisitor(id: string) {
  return {
    visitorId: id, activeSessionId: 's', lastSeenAt: 1,
    currentPage: { url: '/pricing', title: 'P', enteredAt: 1 },
    scrollPct: 0, leadScore: 4, isHot: false, isTyping: false, socketCount: 1,
  };
}

describe('Toast', () => {
  it('renders nothing when no alerts', () => {
    const { container } = render(<Toast />);
    expect(container.textContent).toBe('');
  });

  it('renders "Hot lead" with gold tint for lead_score_8', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'lead_score_8', timestamp: 1 }];
    const { container, getByRole } = render(<Toast />);
    expect(container.textContent).toContain('Hot lead');
    expect(getByRole('alert').className).toMatch(/bg-brand-gold/);
  });

  it('renders "Warm visitor" with navy tint for warm_visitor', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'warm_visitor', timestamp: 1 }];
    const { container, getByRole } = render(<Toast />);
    expect(container.textContent).toContain('Warm visitor');
    expect(getByRole('alert').className).toMatch(/bg-brand-navy/);
  });

  it('clicking a warm_visitor toast (no conversation) sets pendingPing', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'warm_visitor', timestamp: 1 }];
    const { getByRole } = render(<Toast />);
    fireEvent.click(getByRole('alert'));
    expect(pendingPing.value).toBe('v_a');
    expect(selectedConversationId.value).toBeNull();
  });

  it('clicking a lead_score_8 toast with an existing conversation selects it', () => {
    liveVisitors.value = { v_a: makeVisitor('v_a') };
    conversations.value = {
      c_1: {
        id: 'c_1', visitor_id: 'v_a', opened_session_id: null,
        status: 'live', opened_at: 1, closed_at: null, last_message_at: 1,
        initiated_by: 'visitor', timeout_capture: null, messages: [],
      },
    };
    pendingAlerts.value = [{ visitorId: 'v_a', reason: 'lead_score_8', timestamp: 1 }];
    const { getByRole } = render(<Toast />);
    fireEvent.click(getByRole('alert'));
    expect(selectedConversationId.value).toBe('c_1');
    expect(pendingPing.value).toBeNull();
  });
});
