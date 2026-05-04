import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { InstallPrompt, installEvent, dismissed } from '../../src/components/InstallPrompt.js';

beforeEach(() => {
  cleanup();
  installEvent.value = null;
  dismissed.value = false;
  // jsdom returns matches=false by default for matchMedia, which is what we
  // want — InstallPrompt only hides for standalone display mode.
});

describe('InstallPrompt', () => {
  it('returns null when no beforeinstallprompt event has been captured', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.textContent).toBe('');
  });

  it('renders an "Install app" button when an install event is queued', () => {
    installEvent.value = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    };
    const { getByText } = render(<InstallPrompt />);
    expect(getByText('Install app')).toBeTruthy();
  });

  it('hides itself once the user has dismissed the prompt', () => {
    installEvent.value = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    };
    dismissed.value = true;
    const { container } = render(<InstallPrompt />);
    expect(container.textContent).toBe('');
  });

  it('hides itself when running in standalone display mode', () => {
    installEvent.value = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    };
    const original = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({
      matches: q === '(display-mode: standalone)',
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    });
    try {
      const { container } = render(<InstallPrompt />);
      expect(container.textContent).toBe('');
    } finally {
      (window as any).matchMedia = original;
    }
  });

  it('clicking the button calls evt.prompt() and clears the event', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    installEvent.value = {
      prompt: promptFn,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    };
    const { getByText } = render(<InstallPrompt />);
    fireEvent.click(getByText('Install app'));
    await new Promise((r) => setTimeout(r, 0));
    expect(promptFn).toHaveBeenCalled();
    expect(installEvent.value).toBeNull();
  });
});
