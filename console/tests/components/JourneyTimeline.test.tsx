import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { JourneyTimeline } from '../../src/components/JourneyTimeline.js';
import { visitorDetail } from '../../src/state/visitorDetail.js';
import type { LiveVisitor } from '../../src/state/types.js';

const baseVisitor: LiveVisitor = {
  visitorId: 'v_abc',
  activeSessionId: 's_1',
  lastSeenAt: 1,
  currentPage: { url: '/pricing', title: 'Pricing', enteredAt: 1 },
  scrollPct: 0,
  leadScore: 0,
  isHot: false,
  isTyping: false,
  socketCount: 1,
};

beforeEach(() => {
  visitorDetail.value = null;
  cleanup();
});

describe('JourneyTimeline', () => {
  it('falls back to current page when pageViews is empty', () => {
    const { getByText } = render(<JourneyTimeline visitor={baseVisitor} />);
    expect(getByText('/pricing')).toBeTruthy();
  });

  it('renders pageViews and highlights the current page', () => {
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [
        { id: 1, url: '/home', title: 'Home', entered_at: 100, scroll_pct: 0 },
        { id: 2, url: '/pricing', title: 'Pricing', entered_at: 200, scroll_pct: 0 },
        { id: 3, url: '/contact', title: 'Contact', entered_at: 300, scroll_pct: 0 },
      ],
      leadSignals: [],
      recentConversations: [],
      visitCount: 1,
    };
    const { getByText, container } = render(<JourneyTimeline visitor={baseVisitor} />);
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Pricing')).toBeTruthy();
    expect(getByText('Contact')).toBeTruthy();
    // 'now' badge marks current page
    expect(getByText('now')).toBeTruthy();
    // Current page row has a highlight class (text-blue-700 or similar)
    const highlighted = container.querySelector('[data-current="true"]');
    expect(highlighted).toBeTruthy();
    expect(highlighted!.textContent).toContain('Pricing');
  });

  it('uses url when title is null', () => {
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: null,
      pageViews: [{ id: 1, url: '/no-title', title: null, entered_at: 100, scroll_pct: 0 }],
      leadSignals: [],
      recentConversations: [],
      visitCount: 1,
    };
    const { getAllByText } = render(<JourneyTimeline visitor={baseVisitor} />);
    expect(getAllByText('/no-title').length).toBeGreaterThan(0);
  });
});
