import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/preact';
import { SettingsPage } from '../../src/panels/SettingsPage.js';
import { quickReplies } from '../../src/state/store.js';
import * as api from '../../src/api/quickRepliesApi.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  quickReplies.value = [];
  vi.restoreAllMocks();
  cleanup();
});

describe('SettingsPage', () => {
  it('lists existing replies', async () => {
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([
      { id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 },
    ]);
    render(<SettingsPage />);
    await waitFor(() => expect(screen.queryByText('Hi')).toBeTruthy());
    expect(screen.queryByText('Hello there')).toBeTruthy();
  });

  it('adds a new reply', async () => {
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([
      { id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 },
    ]);
    const createSpy = vi.spyOn(api, 'createQuickReply').mockResolvedValue(
      { id: 2, label: 'Bye', body: 'See ya', sort_order: 1 },
    );
    render(<SettingsPage />);
    await waitFor(() => expect(screen.queryByText('Hi')).toBeTruthy());

    fireEvent.input(screen.getByPlaceholderText(/Chip label/i), { target: { value: 'Bye' } });
    fireEvent.input(screen.getByPlaceholderText(/Message body/i), { target: { value: 'See ya' } });
    fireEvent.click(screen.getByText('Add reply'));

    await waitFor(() => expect(screen.queryByText('Bye')).toBeTruthy());
    expect(createSpy).toHaveBeenCalledWith('Bye', 'See ya');
  });

  it('deletes a reply', async () => {
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([
      { id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 },
    ]);
    const delSpy = vi.spyOn(api, 'deleteQuickReply').mockResolvedValue(undefined as any);
    render(<SettingsPage />);
    await waitFor(() => expect(screen.queryByText('Hi')).toBeTruthy());

    fireEvent.click(screen.getByText('Delete'));

    expect(delSpy).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.queryByText('Hi')).toBeNull());
  });

  it('enters edit mode and saves', async () => {
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([
      { id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 },
    ]);
    const updSpy = vi.spyOn(api, 'updateQuickReply').mockResolvedValue(
      { id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 },
    );
    render(<SettingsPage />);
    await waitFor(() => expect(screen.queryByText('Hi')).toBeTruthy());

    fireEvent.click(screen.getByText('Edit'));
    // Edit form should now be rendered
    expect(screen.queryByText('Save')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeTruthy();

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updSpy).toHaveBeenCalled());
    expect(updSpy).toHaveBeenCalledWith(1, { label: 'Hi', body: 'Hello there', sort_order: 0 });
  });

  it('shows empty state when no replies exist', async () => {
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([]);
    render(<SettingsPage />);
    await waitFor(() =>
      expect(screen.queryByText('No quick replies yet. Add one below.')).toBeTruthy(),
    );
  });

  it('shows error when list fails', async () => {
    vi.spyOn(api, 'listQuickReplies').mockRejectedValue(new Error('list failed: 500'));
    render(<SettingsPage />);
    await waitFor(() =>
      expect(screen.queryByText('list failed: 500')).toBeTruthy(),
    );
  });

  it('cancels edit mode without saving', async () => {
    vi.spyOn(api, 'listQuickReplies').mockResolvedValue([
      { id: 1, label: 'Hi', body: 'Hello there', sort_order: 0 },
    ]);
    render(<SettingsPage />);
    await waitFor(() => expect(screen.queryByText('Hi')).toBeTruthy());

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.queryByText('Save')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));

    // Should return to view mode
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Edit')).toBeTruthy();
  });
});
