import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { ChatThread } from '../../src/components/ChatThread.js';
import type { Message } from '../../src/state/types.js';

function msg(id: number, sender: 'visitor' | 'operator' | 'system', body: string, sent_at: number): Message {
  return { id, conversation_id: 'c_a', sender, body, sent_at, seen_at: null, quick_reply_id: null };
}

describe('ChatThread', () => {
  it('renders a per-message timestamp', () => {
    const ts = new Date('2026-05-04T14:30:00').getTime();
    const { container } = render(<ChatThread messages={[msg(1, 'visitor', 'hi', ts)]} />);
    // Time format includes a digit and AM/PM or 24h colon
    expect(container.textContent).toMatch(/\d:\d{2}/);
  });

  it('shows "Today" divider for messages sent today', () => {
    const ts = Date.now();
    const { container } = render(<ChatThread messages={[msg(1, 'visitor', 'hi', ts)]} />);
    expect(container.textContent).toContain('Today');
  });

  it('shows separate day dividers for messages on different days', () => {
    const today = Date.now();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const { container } = render(<ChatThread messages={[
      msg(1, 'visitor', 'old', yesterday),
      msg(2, 'operator', 'new', today),
    ]} />);
    expect(container.textContent).toContain('Yesterday');
    expect(container.textContent).toContain('Today');
  });

  it('does not duplicate dividers within the same day', () => {
    const t1 = Date.now() - 60_000;
    const t2 = Date.now();
    const { container } = render(<ChatThread messages={[
      msg(1, 'visitor', 'one', t1),
      msg(2, 'operator', 'two', t2),
    ]} />);
    const todays = container.textContent?.match(/Today/g) ?? [];
    expect(todays.length).toBe(1);
  });

  it('renders empty state when no messages', () => {
    const { container } = render(<ChatThread messages={[]} />);
    expect(container.textContent).toContain('No messages yet');
  });
});
