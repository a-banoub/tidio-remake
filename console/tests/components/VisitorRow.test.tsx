import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { VisitorRow, visitorDisplayName } from '../../src/components/VisitorRow.js';
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
});
