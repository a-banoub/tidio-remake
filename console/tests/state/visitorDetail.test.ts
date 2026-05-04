import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { tokenStore } from '../../src/auth/tokenStore.js';
import { fetchVisitorDetail, visitorDetail, visitorDetailLoading } from '../../src/state/visitorDetail.js';

describe('visitorDetail signal', () => {
  beforeEach(() => {
    visitorDetail.value = null;
    visitorDetailLoading.value = false;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when no token is set', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await fetchVisitorDetail('v_abc');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(visitorDetail.value).toBeNull();
  });

  it('sets visitorDetail signal from JSON and sends bearer header', async () => {
    tokenStore.set('TOKEN_XYZ');
    const payload = {
      visitor: { id: 'v_abc', first_seen_at: 1, last_seen_at: 2, name: 'X', email: null, phone: null },
      session: { id: 's_1' },
      pageViews: [],
      leadSignals: [],
      recentConversations: [],
      visitCount: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchVisitorDetail('v_abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/operator/visitor/v_abc');
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer TOKEN_XYZ' });
    expect(visitorDetail.value).toEqual(payload);
    expect(visitorDetailLoading.value).toBe(false);
  });

  it('clears visitorDetail signal on non-ok response', async () => {
    tokenStore.set('TOKEN_XYZ');
    visitorDetail.value = { visitCount: 99 } as any;
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchVisitorDetail('v_missing');
    expect(visitorDetail.value).toBeNull();
  });
});
