import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { SetupPage } from '../../src/auth/SetupPage.js';
import { tokenStore } from '../../src/auth/tokenStore.js';

describe('SetupPage', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fillForm(getByLabelText: any, opts: { email: string; name: string; password: string; confirm: string }) {
    fireEvent.input(getByLabelText('Email'), { target: { value: opts.email } });
    fireEvent.input(getByLabelText('Display name'), { target: { value: opts.name } });
    fireEvent.input(getByLabelText('Password'), { target: { value: opts.password } });
    fireEvent.input(getByLabelText('Confirm password'), { target: { value: opts.confirm } });
  }

  it('renders form fields', () => {
    const { getByLabelText, getByText } = render(<SetupPage />);
    expect(getByLabelText('Email')).toBeTruthy();
    expect(getByLabelText('Display name')).toBeTruthy();
    expect(getByLabelText('Password')).toBeTruthy();
    expect(getByLabelText('Confirm password')).toBeTruthy();
    expect(getByText('Create operator')).toBeTruthy();
  });

  it('rejects mismatched passwords without calling fetch', async () => {
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;
    const { getByLabelText, getByText, findByText } = render(<SetupPage />);
    fillForm(getByLabelText, {
      email: 'admin@example.com',
      name: 'Admin',
      password: 'longenough123',
      confirm: 'differentpass',
    });
    fireEvent.click(getByText('Create operator'));
    expect(fetchSpy).not.toHaveBeenCalled();
    await findByText(/passwords do not match/i);
  });

  it('rejects too-short password', async () => {
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;
    const { getByLabelText, getByText, findByText } = render(<SetupPage />);
    fillForm(getByLabelText, {
      email: 'admin@example.com',
      name: 'Admin',
      password: 'short',
      confirm: 'short',
    });
    fireEvent.click(getByText('Create operator'));
    expect(fetchSpy).not.toHaveBeenCalled();
    await findByText(/at least 8 characters/i);
  });

  it('on success stores token and redirects', async () => {
    const setSpy = vi.spyOn(tokenStore, 'set');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, token: 'abc123' }),
    });
    (globalThis as any).fetch = fetchSpy;
    // Stub location.hash assignment
    const origHash = window.location.hash;

    const { getByLabelText, getByText } = render(<SetupPage />);
    fillForm(getByLabelText, {
      email: 'admin@example.com',
      name: 'Admin',
      password: 'longenough123',
      confirm: 'longenough123',
    });
    fireEvent.click(getByText('Create operator'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe('/api/operator/setup');
    expect(call[1].method).toBe('POST');
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody).toEqual({
      email: 'admin@example.com',
      displayName: 'Admin',
      password: 'longenough123',
    });

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith('abc123'));
    window.location.hash = origHash;
  });

  it('on 409 redirects to login (does not store token)', async () => {
    const setSpy = vi.spyOn(tokenStore, 'set');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'already_setup' }),
    });
    (globalThis as any).fetch = fetchSpy;

    const { getByLabelText, getByText } = render(<SetupPage />);
    fillForm(getByLabelText, {
      email: 'admin@example.com',
      name: 'Admin',
      password: 'longenough123',
      confirm: 'longenough123',
    });
    fireEvent.click(getByText('Create operator'));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(setSpy).not.toHaveBeenCalled();
  });
});
