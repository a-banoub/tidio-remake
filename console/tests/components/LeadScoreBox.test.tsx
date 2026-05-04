import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { LeadScoreBox } from '../../src/components/LeadScoreBox.js';
import { visitorDetail } from '../../src/state/visitorDetail.js';
import type { LiveVisitor } from '../../src/state/types.js';

const baseVisitor: LiveVisitor = {
  visitorId: 'v_abc',
  activeSessionId: 's_1',
  lastSeenAt: 1,
  currentPage: { url: '/x', title: null, enteredAt: 1 },
  scrollPct: 0,
  leadScore: 7,
  isHot: true,
  isTyping: false,
  socketCount: 1,
};

beforeEach(() => {
  visitorDetail.value = null;
  cleanup();
});

describe('LeadScoreBox', () => {
  it('renders score-only when visitorDetail is absent', () => {
    const { getByText } = render(<LeadScoreBox visitor={baseVisitor} />);
    expect(getByText('Lead score')).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
  });

  it('renders breakdown rows from visitorDetail.leadSignals', () => {
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [],
      leadSignals: [
        { id: 1, kind: 'returning_visitor', payload: null, score: 2, created_at: 10 },
        { id: 2, kind: 'google_ads_click', payload: null, score: 3, created_at: 20 },
        { id: 3, kind: 'pricing_page_view', payload: null, score: 1, created_at: 30 },
      ],
      recentConversations: [],
      visitCount: 2,
    };
    const { getByText } = render(<LeadScoreBox visitor={baseVisitor} />);
    expect(getByText('Returning visitor')).toBeTruthy();
    expect(getByText('Google Ads click')).toBeTruthy();
    expect(getByText('Viewed pricing')).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
    expect(getByText('+3')).toBeTruthy();
    expect(getByText('+1')).toBeTruthy();
  });

  it('does not render breakdown when visitorDetail.visitor.id mismatches', () => {
    visitorDetail.value = {
      visitor: { id: 'v_OTHER', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [],
      leadSignals: [
        { id: 1, kind: 'returning_visitor', payload: null, score: 2, created_at: 10 },
      ],
      recentConversations: [],
      visitCount: 1,
    };
    const { queryByText } = render(<LeadScoreBox visitor={baseVisitor} />);
    expect(queryByText('Returning visitor')).toBeNull();
  });
});
