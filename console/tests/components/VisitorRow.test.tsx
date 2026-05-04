import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { VisitorRow, visitorDisplayName, relativeTime } from '../../src/components/VisitorRow.js';
import type { LiveVisitor } from '../../src/state/types.js';

function makeVisitor(overrides: Partial<LiveVisitor> = {}): LiveVisitor {
  return {
    visitorId: 'v_abcdef123456',
    activeSessionId: 's_1',
    lastSeenAt: 1,
    currentPage: { url: 'https://example.com/pricing', title: 'Pricing', enteredAt: 1 },
    scrollPct: 0,
    leadScore: 0,
    isHot: false,
    isTyping: false,
    socketCount: 1,
    ...overrides,
  };
}

describe('visitorDisplayName', () => {
  it('returns visitor name when present', () => {
    expect(visitorDisplayName(makeVisitor({ name: 'Alex' }))).toBe('Alex');
  });

  it('returns Visitor #<last6> when name is missing', () => {
    expect(visitorDisplayName(makeVisitor({ name: undefined }))).toBe('Visitor #123456');
  });

  it('falls back to Anonymous for empty visitorId', () => {
    expect(visitorDisplayName(makeVisitor({ visitorId: '', name: undefined }))).toBe('Anonymous');
  });

  it('treats whitespace-only name as missing', () => {
    expect(visitorDisplayName(makeVisitor({ name: '   ' }))).toBe('Visitor #123456');
  });
});

describe('VisitorRow', () => {
  it('renders Visitor #<id> when name missing', () => {
    const { container } = render(<VisitorRow visitor={makeVisitor({ name: undefined })} onClick={() => {}} />);
    expect(container.textContent).toContain('Visitor #123456');
    expect(container.textContent).not.toContain('Anonymous');
  });

  it('renders the page path, not full URL', () => {
    const { container } = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} />);
    expect(container.textContent).toContain('/pricing');
    expect(container.textContent).not.toContain('https://example.com/pricing');
  });

  it('renders Home for root path', () => {
    const { container } = render(<VisitorRow visitor={makeVisitor({ currentPage: { url: 'https://example.com/', title: null, enteredAt: 1 } })} onClick={() => {}} />);
    expect(container.textContent).toContain('Home');
  });

  it('shows Hot badge when isHot', () => {
    const { container } = render(<VisitorRow visitor={makeVisitor({ isHot: true, leadScore: 9 })} onClick={() => {}} />);
    expect(container.textContent).toContain('Hot');
  });

  it('renders relative lastMessageAt timestamp when provided', () => {
    const now = Date.now();
    const { container } = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} lastMessageAt={now - 5 * 60 * 1000} />);
    expect(container.textContent).toContain('5m ago');
  });

  it('omits timestamp when lastMessageAt is missing', () => {
    const { container } = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} />);
    expect(container.textContent).not.toMatch(/ago/);
  });

  it('renders unread badge when unread > 0', () => {
    const { getByTestId } = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} unread={3} />);
    expect(getByTestId('unread-badge').textContent).toBe('3');
  });

  it('caps unread badge at 99+', () => {
    const { getByTestId } = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} unread={150} />);
    expect(getByTestId('unread-badge').textContent).toBe('99+');
  });

  it('omits unread badge when unread is 0 or missing', () => {
    const a = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} unread={0} />);
    expect(a.queryByTestId('unread-badge')).toBeNull();
    a.unmount();
    const b = render(<VisitorRow visitor={makeVisitor()} onClick={() => {}} />);
    expect(b.queryByTestId('unread-badge')).toBeNull();
  });
});

describe('relativeTime', () => {
  const NOW = 1_700_000_000_000;
  it('"just now" under 45 seconds', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('just now');
  });
  it('minutes', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5m ago');
  });
  it('hours', () => {
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3h ago');
  });
  it('days', () => {
    expect(relativeTime(NOW - 2 * 86_400_000, NOW)).toBe('2d ago');
  });
  it('falls back to date for >7 days', () => {
    const ts = NOW - 14 * 86_400_000;
    const out = relativeTime(ts, NOW);
    expect(out).not.toMatch(/ago/);
    expect(out.length).toBeGreaterThan(0);
  });
});
