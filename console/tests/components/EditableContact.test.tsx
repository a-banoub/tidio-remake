import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { EditableContact } from '../../src/components/EditableContact.js';
import type { LiveVisitor } from '../../src/state/types.js';
import * as wsBoot from '../../src/wsBoot.js';

function makeVisitor(overrides: Partial<LiveVisitor> = {}): LiveVisitor {
  return {
    visitorId: 'v_abcdef123456',
    activeSessionId: 's_1',
    lastSeenAt: 1,
    currentPage: { url: '/x', title: null, enteredAt: 1 },
    scrollPct: 0,
    leadScore: 0,
    isHot: false,
    isTyping: false,
    socketCount: 1,
    ...overrides,
  };
}

describe('EditableContact', () => {
  let send: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    send = vi.fn();
    vi.spyOn(wsBoot, 'getWs').mockReturnValue({ send } as any);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Save button is disabled when nothing has changed', () => {
    const { getByText } = render(<EditableContact visitor={makeVisitor({ name: 'Pat' })} />);
    const btn = getByText('Save') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('typing in name enables Save and shows Unsaved changes', () => {
    const { getByText, container } = render(<EditableContact visitor={makeVisitor({ name: 'Pat' })} />);
    const nameInput = container.querySelectorAll('input')[0] as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Patricia' } });
    const btn = getByText('Save') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(container.textContent).toContain('Unsaved changes');
  });

  it('clicking Save sends update_visitor and shows Saved ✓', () => {
    const { getByText, container, getByTestId } = render(<EditableContact visitor={makeVisitor({ name: 'Pat' })} />);
    const inputs = container.querySelectorAll('input');
    fireEvent.input(inputs[0], { target: { value: 'Patricia' } });
    fireEvent.input(inputs[1], { target: { value: 'pat@example.com' } });
    fireEvent.click(getByText('Save'));
    expect(send).toHaveBeenCalledWith({
      type: 'update_visitor',
      visitorId: 'v_abcdef123456',
      name: 'Patricia',
      email: 'pat@example.com',
      phone: '',
    });
    expect(getByTestId('saved-indicator').textContent).toContain('Saved');
  });

  it('Saved ✓ indicator clears after timeout', async () => {
    const { getByText, container, queryByTestId } = render(<EditableContact visitor={makeVisitor()} />);
    fireEvent.input(container.querySelectorAll('input')[0], { target: { value: 'New' } });
    fireEvent.click(getByText('Save'));
    expect(queryByTestId('saved-indicator')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2600);
    expect(queryByTestId('saved-indicator')).toBeNull();
  });

  it('does not send when nothing changed (button disabled, click no-op)', () => {
    const { getByText } = render(<EditableContact visitor={makeVisitor({ name: 'Pat' })} />);
    fireEvent.click(getByText('Save'));
    expect(send).not.toHaveBeenCalled();
  });

  it('blurring input no longer auto-saves (explicit Save required)', () => {
    const { container } = render(<EditableContact visitor={makeVisitor({ name: 'Pat' })} />);
    const nameInput = container.querySelectorAll('input')[0] as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Different' } });
    fireEvent.blur(nameInput);
    expect(send).not.toHaveBeenCalled();
  });
});
