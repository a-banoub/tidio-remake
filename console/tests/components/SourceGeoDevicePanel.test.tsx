import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { SourceGeoDevicePanel } from '../../src/components/SourceGeoDevicePanel.js';
import { visitorDetail } from '../../src/state/visitorDetail.js';
import { liveVisitors } from '../../src/state/store.js';
import type { LiveVisitor } from '../../src/state/types.js';

const baseVisitor: LiveVisitor = {
  visitorId: 'v_abc',
  activeSessionId: 's_1',
  lastSeenAt: 1,
  currentPage: { url: '/x', title: null, enteredAt: 1 },
  scrollPct: 42,
  leadScore: 0,
  isHot: false,
  isTyping: false,
  socketCount: 1,
};

beforeEach(() => {
  visitorDetail.value = null;
  liveVisitors.value = { v_abc: baseVisitor };
  cleanup();
});

describe('SourceGeoDevicePanel', () => {
  it('returns null when visitorDetail is missing', () => {
    const { container } = render(<SourceGeoDevicePanel visitor={baseVisitor} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Source / Geo / Device / Engagement when fully populated', () => {
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'spring-sale',
        utm_term: '1031 exchange',
        gclid: 'abc123',
        city: 'San Francisco',
        region: 'CA',
        country: 'US',
        timezone: 'America/Los_Angeles',
        device_type: 'desktop',
        browser: 'Chrome',
        os: 'macOS',
      },
      pageViews: [],
      leadSignals: [
        { id: 1, kind: 'calculator_used', payload: null, score: 1, created_at: 10 },
        { id: 2, kind: 'returning_visitor', payload: null, score: 2, created_at: 11 },
      ],
      recentConversations: [],
      visitCount: 1,
    };
    const { getByText, queryByText } = render(<SourceGeoDevicePanel visitor={baseVisitor} />);

    // Source: gclid means Google Ads channel
    expect(getByText('Google Ads')).toBeTruthy();
    expect(getByText(/spring-sale/)).toBeTruthy();

    // Geo
    expect(getByText(/San Francisco/)).toBeTruthy();

    // Device
    expect(getByText(/Chrome/)).toBeTruthy();

    // Engagement: calculator_used label appears; returning_visitor is not engagement
    expect(getByText('Used calculator')).toBeTruthy();
    expect(queryByText('Returning visitor')).toBeNull();

    // Engagement: scroll pct
    expect(getByText(/42%/)).toBeTruthy();
  });

  it('shows Direct when no source attributes are present', () => {
    visitorDetail.value = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: null, email: null, phone: null },
      session: {
        utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, gclid: null,
        city: null, region: null, country: null, timezone: null,
        device_type: null, browser: null, os: null,
      },
      pageViews: [],
      leadSignals: [],
      recentConversations: [],
      visitCount: 1,
    };
    const { getByText } = render(<SourceGeoDevicePanel visitor={baseVisitor} />);
    expect(getByText('Direct')).toBeTruthy();
  });
});
